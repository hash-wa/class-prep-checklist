"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PrinterIcon } from "@/components/icons";
import { MarkdownContent } from "@/components/MarkdownContent";

export type PdfExportItem = {
  id: number | string;
  title: string;
  done?: boolean;
  irrelevant?: boolean;
  meta?: string | null;
  description?: string | null;
  subItems?: { text: string; done?: boolean }[];
};

export type PdfExportSection = {
  key: string;
  title: string | null;
  items: PdfExportItem[];
};

type Orientation = "portrait" | "landscape";
type Fit = "1" | "2" | "none";
type GapUnit = "in" | "cm" | "px";
type Align = "left" | "center" | "right";

const ALIGN_TO_JUSTIFY: Record<Align, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

// Assumes US Letter paper — the app has no page-size setting, so this is a fixed default
// rather than something exposed in the UI.
const DPI = 96;
const PAGE_MARGIN_IN = 0.5;
const PAGE_SIZE_IN: Record<Orientation, { w: number; h: number }> = {
  portrait: { w: 8.5, h: 11 },
  landscape: { w: 11, h: 8.5 },
};

const UNIT_TO_PX: Record<GapUnit, number> = { in: DPI, cm: DPI / 2.54, px: 1 };

// The vertical gap between sections stays fixed — only the column gap is user-configurable.
const SECTION_GAP_PX = 28;

function CheckBox({ checked, spacing = 3 }: { checked: boolean; spacing?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 11,
        height: 11,
        borderRadius: "50%",
        border: "1.3px solid #111",
        marginRight: spacing,
        verticalAlign: "middle",
        background: checked ? "#111" : "transparent",
        flexShrink: 0,
      }}
    />
  );
}

function PrintContent({
  documentTitle,
  subtitle,
  sections,
}: {
  documentTitle: string;
  subtitle?: string;
  sections: PdfExportSection[];
}) {
  return (
    <div className="pdf-doc">
      <h1 className="pdf-title">{documentTitle}</h1>
      {subtitle && <p className="pdf-subtitle">{subtitle}</p>}
      <div className="pdf-columns">
        {sections.map((section) => (
          <div className="pdf-section" key={section.key}>
            {section.title && <h2 className="pdf-section-title">{section.title}</h2>}
            <ul className="pdf-item-list">
              {section.items.map((item) => (
                <li key={item.id} className={`pdf-item ${item.irrelevant ? "pdf-item-na" : ""}`}>
                  <div className="pdf-item-row">
                    <CheckBox checked={!!item.done} spacing={1} />
                    <span className="pdf-item-title">
                      {item.title}
                      {item.irrelevant && <span className="pdf-na-tag"> (N/A)</span>}
                    </span>
                    {item.meta && <span className="pdf-item-meta">{item.meta}</span>}
                  </div>
                  {item.description && (
                    <div className="pdf-item-description">
                      <MarkdownContent text={item.description} />
                    </div>
                  )}
                  {item.subItems && item.subItems.length > 0 && (
                    <ul className="pdf-subitem-list">
                      {item.subItems.map((sub, i) => (
                        <li key={i} className="pdf-subitem">
                          <CheckBox checked={!!sub.done} />
                          <span>{sub.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PdfExportDialog({
  documentTitle,
  sections,
}: {
  documentTitle: string;
  sections: PdfExportSection[];
}) {
  const [open, setOpen] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [columns, setColumns] = useState<1 | 2 | 3>(1);
  const [fit, setFit] = useState<Fit>("none");
  const [gapAmount, setGapAmount] = useState(0.3);
  const [gapUnit, setGapUnit] = useState<GapUnit>("in");
  const [align, setAlign] = useState<Align>("center");
  const [naturalHeight, setNaturalHeight] = useState(0);
  const measureRef = useRef<HTMLDivElement>(null);

  const columnGapPx = Math.max(0, gapAmount) * UNIT_TO_PX[gapUnit];

  function handleGapUnitChange(newUnit: GapUnit) {
    setGapAmount((prev) => {
      const px = Math.max(0, prev) * UNIT_TO_PX[gapUnit];
      const converted = px / UNIT_TO_PX[newUnit];
      return newUnit === "px" ? Math.round(converted) : Math.round(converted * 100) / 100;
    });
    setGapUnit(newUnit);
  }

  const nonEmptySections = useMemo(() => sections.filter((s) => s.items.length > 0), [sections]);

  // Chromium/Edge/Safari's "Save as PDF" print dialog suggests document.title as the filename,
  // so swap it in for the print call and restore it right after — the browser reads it
  // synchronously when the print dialog opens, so no delay is needed before restoring.
  function handlePrint() {
    const previousTitle = document.title;
    document.title = documentTitle.replace(/[\\/:*?"<>|]/g, "-");
    window.print();
    document.title = previousTitle;
  }

  const subtitle = useMemo(
    () =>
      `Generated ${new Date().toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}`,
    // Only needs to be stable per dialog-open, not reactive to every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  const { w: pageWIn, h: pageHIn } = PAGE_SIZE_IN[orientation];
  const contentWidthPx = Math.round((pageWIn - PAGE_MARGIN_IN * 2) * DPI);
  const contentHeightPx = Math.round((pageHIn - PAGE_MARGIN_IN * 2) * DPI);

  // Measured at zoom:1 in a separate, always-natural-scale copy so the fit-to-page
  // calculation below never has to divide its own scaling back out.
  useEffect(() => {
    if (!open || !measureRef.current) return;
    const el = measureRef.current;
    const measure = () => setNaturalHeight(el.scrollHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, columns, orientation, nonEmptySections]);

  const scale = useMemo(() => {
    if (fit === "none" || naturalHeight === 0) return 1;
    // The on-screen measurement (at zoom:1) runs slightly smaller than the real print
    // render, so a straight ratio lands just over the page boundary — leave some headroom.
    const FIT_SAFETY_FACTOR = 0.75;
    const targetHeight = contentHeightPx * Number(fit) * FIT_SAFETY_FACTOR;
    return Math.min(1, targetHeight / naturalHeight);
  }, [fit, naturalHeight, contentHeightPx]);

  const printCss = `
    /* The measurement copy must never participate in layout flow, in either media —
       otherwise its (invisible but full-height) box pushes the real print content down
       and can add blank pages ahead of it. */
    #pdf-export-measure {
      position: fixed;
      left: -99999px;
      top: 0;
    }
    @media screen {
      #pdf-export-print {
        position: fixed;
        left: -99999px;
        top: 0;
      }
    }
    @media print {
      /* NOT display:none — that would collapse its scrollHeight to 0 the instant print
         mode activates, which the ResizeObserver below picks up as a real height change
         and uses to reset the fit-to-page zoom back to 1 right when it matters. The
         unconditional position:fixed above already keeps it out of the page-break flow,
         which is all that's needed to avoid extra blank pages. */
      body * { visibility: hidden !important; }
      #pdf-export-print-portal, #pdf-export-print-portal * { visibility: visible !important; }
      #pdf-export-print-portal {
        position: absolute;
        left: 0;
        top: 0;
        /* Spans the full page content width so the (possibly zoomed-down, to fit N pages)
           print content can be aligned within it instead of always sitting flush against
           the left edge with the shrunk-away space left blank on one side. */
        width: ${contentWidthPx}px;
        display: flex;
        justify-content: ${ALIGN_TO_JUSTIFY[align]};
      }
      @page {
        size: letter ${orientation};
        margin: ${PAGE_MARGIN_IN}in;
        @bottom-center {
          content: "Page " counter(page) " / " counter(pages);
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 9px;
          color: #666;
        }
      }
    }
    #pdf-export-measure, #pdf-export-print {
      width: ${contentWidthPx}px;
      font-family: ui-sans-serif, system-ui, sans-serif;
      color: #111;
    }
    .pdf-doc .pdf-title { font-size: 18px; font-weight: 700; margin: 0 0 2px; }
    .pdf-doc .pdf-subtitle { font-size: 11px; color: #555; margin: 0 0 12px; }
    .pdf-columns { column-count: ${columns}; column-gap: ${columnGapPx}px; }
    .pdf-section { margin-bottom: ${SECTION_GAP_PX}px; }
    .pdf-section-title {
      font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em;
      margin: 0 0 4px; padding-bottom: 2px; border-bottom: 1.2px solid #111;
    }
    .pdf-item-list, .pdf-subitem-list { list-style: none; margin: 0; padding: 0; }
    .pdf-item { break-inside: avoid; padding: 2.5px 0; font-size: 11px; }
    .pdf-item-row { display: flex; align-items: baseline; gap: 4px; }
    .pdf-item-title { flex: 1; }
    .pdf-item-na .pdf-item-title { color: #888; text-decoration: line-through; }
    .pdf-na-tag { font-weight: 600; text-decoration: none; }
    .pdf-item-meta { flex-shrink: 0; font-size: 9.5px; color: #666; }
    .pdf-item-description { margin: 2px 0 2px 17px; }
    .pdf-item-description .md-content { font-size: 10px; color: #444; }
    .pdf-subitem-list { margin-left: 17px; margin-top: 1px; }
    .pdf-subitem { display: flex; align-items: baseline; font-size: 10px; padding: 1px 0; color: #333; }
  `;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        <PrinterIcon /> Export PDF
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-neutral-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Export PDF</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="mb-1.5 font-medium text-black/70 dark:text-white/70">Orientation</div>
                <div className="flex gap-2">
                  {(["portrait", "landscape"] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() => setOrientation(o)}
                      className={`flex-1 rounded-md border px-2 py-1.5 capitalize ${
                        orientation === o
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 font-medium text-black/70 dark:text-white/70">Columns</div>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setColumns(c)}
                      className={`flex-1 rounded-md border px-2 py-1.5 ${
                        columns === c
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {columns > 1 && (
                <div>
                  <div className="mb-1.5 font-medium text-black/70 dark:text-white/70">Space between columns</div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step={gapUnit === "px" ? 1 : 0.05}
                      value={gapAmount}
                      onChange={(e) => setGapAmount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-20 rounded-md border border-black/15 px-2 py-1.5 dark:border-white/20 dark:bg-neutral-900"
                    />
                    <div className="flex flex-1 gap-1.5">
                      {(["in", "cm", "px"] as const).map((u) => (
                        <button
                          key={u}
                          onClick={() => handleGapUnitChange(u)}
                          className={`flex-1 rounded-md border px-2 py-1.5 ${
                            gapUnit === u
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1.5 font-medium text-black/70 dark:text-white/70">Fit to</div>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "1", label: "1 page" },
                      { value: "2", label: "2 pages" },
                      { value: "none", label: "No limit" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFit(f.value)}
                      className={`flex-1 rounded-md border px-2 py-1.5 ${
                        fit === f.value
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {fit !== "none" && (
                  <p className="mt-1.5 text-xs text-black/40 dark:text-white/40">
                    Content shrinks to fit — it won&apos;t enlarge past 100%.
                  </p>
                )}
              </div>

              {fit !== "none" && (
                <div>
                  <div className="mb-1.5 font-medium text-black/70 dark:text-white/70">Alignment</div>
                  <div className="flex gap-2">
                    {(["left", "center", "right"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => setAlign(a)}
                        className={`flex-1 rounded-md border px-2 py-1.5 capitalize ${
                          align === a
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-black/40 dark:text-white/40">
                    Where the shrunk content sits on the page.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handlePrint}
                className="rounded-md border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                Preview
              </button>
              <button
                onClick={() => {
                  handlePrint();
                  setOpen(false);
                }}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <style>{printCss}</style>
            <div id="pdf-export-measure" ref={measureRef} aria-hidden>
              <PrintContent documentTitle={documentTitle} subtitle={subtitle} sections={nonEmptySections} />
            </div>
            <div id="pdf-export-print-portal">
              {/* `transform: scale` doesn't work here — transforms are purely visual and don't
                  change the space an element reserves in normal flow, so it has no effect on
                  print pagination. `zoom` actually is a layout-affecting property Chromium's
                  print engine respects, so it's the one that can actually shrink page count. */}
              <div id="pdf-export-print" style={{ zoom: scale }}>
                <PrintContent documentTitle={documentTitle} subtitle={subtitle} sections={nonEmptySections} />
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
