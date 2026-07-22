#!/usr/bin/env python3
"""Convert Tailwind classes in FacultyWorkload.jsx to vanilla CSS (fw-*)."""
from pathlib import Path

FILE = Path(r"c:\Users\EARIST\Desktop\07-22-2026\frontend\src\faculty\FacultyWorkload.jsx")

# Longest-first replacements (static strings)
REPLACEMENTS = [
    # Constants block - handled separately via direct string replace at end

    # Multi-class compound patterns (longest first)
    ("h-[1.25rem] border border-black border-t-0 border-l-0 flex items-center justify-center", "fw-slot fw-slot-top"),
    ("h-[1.25rem] border border-black border-l-0 flex items-center justify-center", "fw-slot fw-slot-bottom"),
    ("border border border-black border-l-0 bg-[#eaeaea] border-b-0 text-[11px] text-center flex items-center justify-center", "fw-workload-header-cell"),
    ("border border border-black border-l-0 bg-[#eaeaea] border-b-0 border-r-0 text-[11px] text-center flex items-center justify-center", "fw-workload-header-cell-total"),
    ("border border border-black border-l-0 border-b-0 text-[10px] bg-yellow-300 flex items-center justify-center px-1", "fw-workload-label-cell fw-bg-yellow-300 fw-text-10"),
    ("border border border-black border-l-0 border-b-0 text-[10px] bg-[#ccffff] flex items-center justify-center px-1", "fw-workload-label-cell fw-bg-ccffff fw-text-10"),
    ("border border border-black border-l-0 border-b-0 text-[10px] bg-[#e6ccff] flex items-center justify-center px-1", "fw-workload-label-cell fw-bg-e6ccff fw-text-10"),
    ("border border border-black border-l-0 bg-[#ffd9b3] border-b-0 text-[9.5px] flex items-center justify-center px-1", "fw-workload-label-cell fw-bg-ffd9b3 fw-text-9-5"),
    ("border border border-black border-l-0 border-b-0 text-[10px] bg-[#99ccff] flex items-center justify-center px-1", "fw-workload-label-cell fw-bg-99ccff fw-text-10"),
    ("border border-black border-l-0 border-b-0 text-[10px] text-center flex items-center justify-center px-[0.4rem] bg-[#ccffcc]", "fw-workload-other-group-label fw-bg-ccffcc"),
    ("border border border-black border-l-0 bg-[#ccffcc] border-b-0 text-[9px] text-center font-[600] flex items-center justify-center", "fw-workload-label-cell fw-bg-ccffcc fw-text-9 fw-font-600"),
    ("border border bg-[#fde5d6] border-black border-l-0 border-b-0 text-[9px] flex items-center justify-center font-[600]", "fw-workload-label-cell fw-bg-fde5d6 fw-text-9 fw-font-600"),
    ("border border border-black bg-[#f7caac] border-l-0 border-b-0 text-[8px] flex items-center justify-center font-[400] px-1 text-center", "fw-workload-label-cell fw-bg-f7caac fw-text-8 fw-font-400"),
    ("border border border-black border-l-0 border-b-0 text-[8px] flex items-center justify-center font-[400]", "fw-workload-label-cell fw-text-8 fw-font-400"),

    ("border border-black border-t-0 border-l-0 min-h-[2rem] flex items-center justify-center w-[9rem] px-1", "fw-extra-cell fw-w-9rem fw-px-1"),
    ("border border-black border-t-0 border-l-0 min-h-[2rem] flex items-center justify-center w-[2rem]", "fw-extra-cell fw-w-2rem"),
    ("border border-black border-t-0 border-l-0 min-h-[2rem] flex items-center justify-center w-[3.5rem] px-1", "fw-extra-cell fw-w-35rem fw-px-1"),
    ("border border-black border-t-0 border-l-0 min-h-[2rem] flex items-center justify-center w-[6rem] px-1", "fw-extra-cell fw-w-6rem fw-px-1"),
    ("border border-black border-t-0 border-l-0 min-h-[2rem] flex items-center border-r-0 justify-center w-[3.5rem]", "fw-extra-cell fw-extra-cell-r-none fw-w-35rem"),
    ("border border border-black border-l-0 border-t-0 border-b-0 max-w-[8.97rem] text-[10px] text-center font-bold", "fw-border fw-border-l-none fw-border-t-none fw-border-b-none fw-max-w-897rem fw-text-10 fw-text-center fw-font-bold"),
    ("border border border-black border-l-0 border-b-0 border-t-0 text-[10px] min-w-[2rem] text-center", "fw-border fw-border-l-none fw-border-b-none fw-border-t-none fw-text-10 fw-min-w-2rem fw-text-center"),

    ("h-[2.5rem] bg-[#eaeaea] border border-black border-t-0 text-[14px] flex items-center justify-center", "fw-time-label"),
    ("h-[2.5rem] border bg-[#eaeaea] border-black border-t-0 text-[14px] flex items-center justify-center", "fw-time-label"),
    ("min-h-[10rem] mb-[16rem] print-container", "fw-print-container print-container"),
    ("flex align-center information", "fw-info-row information"),
    ("bg-gray-300 border border-black min-w-[13rem] border-r-0 h-[3rem] flex items-center justify-center designation-title", "fw-designation-title designation-title"),
    ("w-[48rem] border border-black flex items-center justify-center designation-details", "fw-designation-details designation-details"),
    ("education-bg bg-gray-300 border border-black w-[13rem] h-full flex items-center justify-center", "fw-education-bg education-bg"),
    ("border border-black border-b-0 border-l-0 w-[48rem] h-[2rem] p-0 flex  educ-details", "fw-educ-row educ-details"),
    ("border border-black border-l-0 w-[48rem] h-[2rem] p-0 flex educ-details", "fw-educ-row-last educ-details"),
    ("educ-title text-[12px] tracking-[-1px] border border-black m-0 px-1 border-b-0 border-l-0 border-t-0 min-w-[8rem] h-full flex items-center", "fw-educ-title educ-title"),
    ("educ-content text-[12px] h-full flex items-center ml-1", "fw-educ-content educ-content"),
    ("educ-content text-[12px]  h-full flex items-center ml-1 MIN-", "fw-educ-content educ-content"),
    ("flex justify-center w-[63rem] text-[20px] font-bold", "fw-assignment-title"),
    ("flex justify-center w-[63rem] text-[14px] tracking-[-0.5px] mt-[-0.4rem]", "fw-assignment-subtitle"),
    ("min-w-[6.5rem] min-h-[2.2rem] flex items-center justify-center border border-black text-[14px] ", "fw-th-time"),
    ("min-w-[6.6rem] text-center border border-black border-l-0 border-b-0 text-[14px]", "fw-th-day-top fw-min-w-66rem"),
    ("h-[20px] min-w-[6.6rem] text-center border border-black border-l-0 text-[11.5px] mt-[-3px]", "fw-th-day-bottom fw-min-w-66rem"),
    ("min-w-[6.8rem] text-center border border-black border-l-0 border-b-0 text-[14px]", "fw-th-day-top fw-min-w-68rem"),
    ("h-[20px] min-w-[6.8rem] text-center border border-black border-l-0 text-[11.5px] mt-[-3px]", "fw-th-day-bottom fw-min-w-68rem"),
    ("min-w-[7rem] text-center border border-black border-l-0 border-b-0 text-[14px]", "fw-th-day-top fw-min-w-7rem"),
    ("h-[20px] min-w-[7rem] text-center border border-black border-l-0 text-[11.5px] mt-[-3px]", "fw-th-day-bottom fw-min-w-7rem"),
    ("min-w-[6.9rem] text-center border border-black border-l-0 border-b-0 text-[14px]", "fw-th-day-top fw-min-w-69rem"),
    ("h-[20px] min-w-[6.9rem] text-center border border-black border-l-0 text-[11.5px] mt-[-3px]", "fw-th-day-bottom fw-min-w-69rem"),
    ("flex flex-col mt-[-0.1px]", "fw-schedule-tbody"),
    ("flex w-full", "fw-schedule-row"),
    ("m-0 p-0 min-w-[13.1rem]", "fw-m-0 fw-p-0 fw-min-w-131rem"),
    ("h-[2.5rem] p-0 m-0", "fw-slot-wrapper"),
    ("absolute inset-0 flex flex-col items-center justify-center text-center text-[11px] leading-tight cursor-pointer", "schedule-block-overlay"),
    ("schedule-block relative w-full h-full cursor-pointer text-center", "schedule-block"),
    ("block truncate text-[10px]", "schedule-text-main"),
    ("block truncate text-[8px]", "schedule-text-sub"),

    ("bg-black text-white text-[12px] font-[500] tracking-[0.5px] h-[1.8rem] min-w-[61rem] text-center", "fw-summary-header"),
    ("mmin-w-[37rem] text-center text-[11px] bg-[#c0c0c0] font-[500]", "fw-summary-section-title fw-min-w-37rem"),
    ("border border-black max-w-[37rem]", "fw-border fw-max-w-37rem"),
    ("border border-black border-l-0 max-w-[24rem]", "fw-border fw-border-l-none fw-max-w-24rem"),
    ("border border-black border-l-0 max-w-[23.9rem]", "fw-border fw-border-l-none fw-max-w-239rem"),
    ("border border-black border-l-0 max-w-[23.9rem]", "fw-border fw-border-l-none fw-max-w-239rem"),

    ("border border-black border-l-0 bg-[#eaeaea] min-h-[2.15rem] flex items-center justify-center w-[9rem]", "fw-honorarium-header-cell fw-w-9rem"),
    ("border border-black border-l-0 bg-[#eaeaea] min-h-[2.15rem] flex items-center justify-center w-[2rem]", "fw-honorarium-header-cell fw-w-2rem"),
    ("border border-black border-l-0 bg-[#eaeaea] min-h-[2.15rem] flex items-center justify-center w-[3.5rem]", "fw-honorarium-header-cell fw-w-35rem"),
    ("border border-black border-l-0 bg-[#eaeaea] min-h-[2.15rem] flex items-center justify-center w-[6rem]", "fw-honorarium-header-cell fw-w-6rem"),
    ("border border-black border-l-0 bg-[#eaeaea] min-h-[2.15rem] flex items-center border-r-0 justify-center w-[3.5rem]", "fw-honorarium-header-cell fw-honorarium-header-cell-r-none fw-w-35rem"),
    ("border border-black bg-[#eaeaea]  border-l-0 min-h-[2.15rem] flex items-center justify-center w-[9rem]", "fw-honorarium-header-cell fw-w-9rem"),
    ("border border-black bg-[#eaeaea] border-l-0 min-h-[2.15rem] flex items-center justify-center w-[2rem]", "fw-honorarium-header-cell fw-w-2rem"),
    ("border border-black bg-[#eaeaea] border-l-0 min-h-[2.15rem] flex items-center justify-center w-[3.5rem]", "fw-honorarium-header-cell fw-w-35rem"),
    ("border border-black bg-[#eaeaea] border-l-0 min-h-[2.15rem] flex items-center justify-center w-[6rem]", "fw-honorarium-header-cell fw-w-6rem"),
    ("border border-black bg-[#eaeaea] border-l-0 min-h-[2.15rem] flex items-center border-r-0 justify-center w-[3.5rem]", "fw-honorarium-header-cell fw-honorarium-header-cell-r-none fw-w-35rem"),
    ("flex max-h-[2.15rem]", "fw-honorarium-header-row"),
    ("flex max-h-[2rem]", "fw-extra-row"),
    ("bg-black min-h-[1.2rem] max-w-[61rem] line", "fw-bg-black fw-min-h-12rem fw-max-w-61rem line"),

    ("border border-black flex flex-col bg-[#eaeaea]", "fw-conforme-box"),
    ("w-[27rem] text-[11px] p-[0.2rem] font-[600] conforme-cont", "fw-w-27rem fw-text-11 fw-w-02rem fw-font-600 conforme-cont"),
    ("text-[10.5px] tracking-[-1px] font-[600] conforme-title", "fw-text-10-5 fw-tracking-tight fw-font-600 conforme-title"),
    ("text-[10.5px] tracking-[-1px] font-[600] conforme", "fw-text-10-5 fw-tracking-tight fw-font-600 conforme"),
    ("bg-black text-white p-[0.2rem] flex items-center justify-center w-[13.5rem]", "fw-conforme-code"),
    ("flex flex-col items-center w-[13.5rem]", "fw-flex fw-flex-col fw-items-center fw-w-135rem"),
    ("flex flex-col mt-[2rem] w-full items-center", "fw-signature-col"),
    ("flex signature-container", "fw-flex signature-container"),
    ("w-[13.5rem] h-[6rem] ", "fw-w-135rem fw-h-6rem"),
    ("w-[19.5rem] h-[6rem] signature-content", "fw-w-195rem fw-h-6rem signature-content"),

    # Day header cells in workload summary
    ("border border border-black border-l-0 bg-[#eaeaea] border-b-0 text-[11px] px-[0.7rem] w-[3.2rem] shrink-0 flex-none flex items-center justify-center", "fw-workload-header-cell fw-day-mon"),
    ("border border border-black border-l-0 bg-[#eaeaea] border-b-0 text-[11px] px-[0.9rem] w-[3.1rem] shrink-0 flex-none flex items-center justify-center", "fw-workload-header-cell fw-day-tue"),
    ("border border border-black border-l-0 bg-[#eaeaea] border-b-0 text-[11px] px-[0.9rem] w-[3.3rem] shrink-0 flex-none flex items-center justify-center", "fw-workload-header-cell fw-day-wed"),
    ("border border border-black border-l-0 bg-[#eaeaea] border-b-0 text-[11px] px-[0.9rem] w-[3.08rem] shrink-0 flex-none flex items-center justify-center", "fw-workload-header-cell fw-day-thu"),
    ("border border border-black border-l-0 bg-[#eaeaea] border-b-0 text-[11px] px-[0.9rem] w-[2.8rem] shrink-0 flex-none flex items-center justify-center", "fw-workload-header-cell fw-day-fri"),
    ("border border border-black border-l-0 bg-[#eaeaea] border-b-0 text-[11px] px-[0.9rem] w-[3.20rem] shrink-0 flex-none flex items-center justify-center", "fw-workload-header-cell fw-day-sat"),
    ("border border border-black border-l-0 bg-[#eaeaea] border-b-0 border-r-0 text-[11px] px-[0.9rem] w-[3.9rem] shrink-0 flex-none flex items-center justify-center", "fw-workload-header-cell-total fw-day-total"),

    # FTE rows - generic patterns
    ("flex min-h-[1.05rem]", "fw-fte-header-row"),
    ("min-w-[23rem] text-center text-[11px] font-[500] bg-[#c0c0c0]", "fw-min-w-23rem fw-text-center fw-text-11 fw-font-500 fw-bg-c0c0c0"),
    ("w-[37rem] text-center text-[11px] font-[500] bg-[#c0c0c0]", "fw-w-37rem fw-text-center fw-text-11 fw-font-500 fw-bg-c0c0c0"),

    # Single utilities
    ("min-w-[7rem]", "fw-min-w-7rem"),
    ("min-w-[6.9rem]", "fw-min-w-69rem"),
    ("min-w-[6.8rem]", "fw-min-w-68rem"),
    ('? "min-w-[7rem]"', '? "fw-min-w-7rem"'),
    ('? "min-w-[6.9rem]"', '? "fw-min-w-69rem"'),
    ('? "min-w-[6.8rem]"', '? "fw-min-w-68rem"'),
    ("border-t-0", "fw-border-t-none"),
    ("border-b-0", "fw-border-b-none"),
    ("border-l-0", "fw-border-l-none"),
    ("border-r-0", "fw-border-r-none"),
    ("flex-col", "fw-flex-col"),
    ("items-center", "fw-items-center"),
    ("justify-center", "fw-justify-center"),
    ("text-center", "fw-text-center"),
    ("font-bold", "fw-font-bold"),
    ("truncate", "fw-truncate"),
    ("shrink-0", "fw-shrink-0"),
    ("flex-none", "fw-flex-none"),
    ("cursor-pointer", "fw-cursor-pointer"),
    ("leading-tight", "fw-leading-tight"),
    ("underline", "fw-underline"),
    ("w-full", "fw-w-full"),
    ("h-full", "fw-h-full"),
    ("relative", "fw-relative"),
    ("absolute", "fw-absolute"),
    ("inset-0", "fw-inset-0"),
    ("block", "fw-block"),
    ("p-0", "fw-p-0"),
    ("m-0", "fw-m-0"),
    ("px-1", "fw-px-1"),
    ("ml-1", "fw-ml-1"),
    ("ml-2", "fw-ml-2"),
    ("ml-[3px]", "fw-ml-3px"),
    ("mt-[2rem]", "fw-mt-2rem"),
    ("mt-[1rem]", "fw-mt-1rem"),
    ("mt-[0.7rem]", "fw-mt-07rem"),
    ("mt-[0.8rem]", "fw-mt-08rem"),
    ("mt-[0.6rem]", "fw-mt-06rem"),
    ("mt-[-0.4rem]", "fw-mt-neg04"),
    ("mt-[-3px]", "fw-mt-neg3px"),
    ("mt-[-1.7rem]", "fw-mt-neg17"),
    ("mt-[-2px]", "fw-mt-neg2px"),
    ("w-[8rem]", "fw-w-8rem"),
    ("w-[48rem]", "fw-w-48rem fw-mt-08rem"),
    ("max-w-[5rem]", "fw-max-w-5rem"),
    ("max-w-[61rem]", "fw-max-w-61rem"),
    ("text-[11px]", "fw-text-11"),
    ("text-[18px]", "fw-text-18"),
    ("text-[14px]", "fw-text-14"),
    ("text-[12px]", "fw-text-12"),
    ("text-[10px]", "fw-text-10"),
    ("text-[11.5px]", "fw-text-11-5"),
    ("text-[8px]", "fw-text-8"),
    ("text-[9px]", "fw-text-9"),
    ("text-[20px]", "fw-text-20"),
    ("tracking-[-1px]", "fw-tracking-tight"),
    ("tracking-[-0.5px]", "fw-tracking-tight-05"),
    ("tracking-[0.5px]", "fw-tracking-wide"),
    ("font-[500]", "fw-font-500"),
    ("font-[600]", "fw-font-600"),
    ("font-[400]", "fw-font-400"),
    ("bg-[#c0c0c0]", "fw-bg-c0c0c0"),
    ("bg-[#eaeaea]", "fw-bg-eaeaea"),
    ("bg-gray-300", "fw-bg-gray-300"),
    ("bg-black", "fw-bg-black"),
    ("text-white", "fw-text-white"),
    ("bg-yellow-300", "fw-bg-yellow-300"),
    ("bg-[#ccffff]", "fw-bg-ccffff"),
    ("bg-[#e6ccff]", "fw-bg-e6ccff"),
    ("bg-[#ffd9b3]", "fw-bg-ffd9b3"),
    ("bg-[#99ccff]", "fw-bg-99ccff"),
    ("bg-[#ccffcc]", "fw-bg-ccffcc"),
    ("bg-[#fde5d6]", "fw-bg-fde5d6"),
    ("bg-[#f7caac]", "fw-bg-f7caac"),
    ("border border-black", "fw-border"),
    ("border border", "fw-border"),
    ("border-black", ""),
    (" flex", " fw-flex"),
    ("className=\"flex", "className=\"fw-flex"),
    ("mt-[0.7rem]", "fw-mt-07rem"),
    ("className=\"mt-[0.7rem]\"", "className=\"fw-schedule-table\""),
]

CONSTANTS_OLD = '''const WORKLOAD_CELL_BASE =
  "border border border-black border-l-0 border-b-0 text-[11px] flex items-center justify-center text-center";

// Heights aligned to EXTRA TEACHING LOADS FOR HONORARIUM (2.15rem header, 2rem data rows)
const WORKLOAD_HEIGHT_DAY_HEADER = "h-[1.075rem]";
const WORKLOAD_HEIGHT_REGULAR = "h-[1.075rem]";
const WORKLOAD_HEIGHT_PAIR = "h-[1rem]";
const WORKLOAD_HEIGHT_OTHER_FUNCTIONS = "h-[1rem]";
const WORKLOAD_HEIGHT_OTHER_FUNCTIONS_GROUP = "h-[4rem]";
const WORKLOAD_HEIGHT_TOTAL = "h-[1.05rem]";

const WORKLOAD_LABEL_WIDTH = "w-[11rem] shrink-0 flex-none";
const WORKLOAD_OTHER_GROUP_WIDTH = "w-[4.3rem] shrink-0 flex-none";
const WORKLOAD_OTHER_SUBLABEL_WIDTH = "w-[6.7rem] shrink-0 flex-none";

const WORKLOAD_DAY_COLUMNS = [
  { key: "MON", className: `${WORKLOAD_CELL_BASE} px-[0.7rem] w-[3.2rem] shrink-0 flex-none` },
  { key: "TUE", className: `${WORKLOAD_CELL_BASE} px-[0.9rem] w-[3.1rem] shrink-0 flex-none` },
  { key: "WED", className: `${WORKLOAD_CELL_BASE} px-[0.9rem] w-[3.3rem] shrink-0 flex-none` },
  { key: "THU", className: `${WORKLOAD_CELL_BASE} px-[0.9rem] w-[3.08rem] shrink-0 flex-none` },
  { key: "FRI", className: `${WORKLOAD_CELL_BASE} px-[0.9rem] w-[2.8rem] shrink-0 flex-none` },
  { key: "SAT", className: `${WORKLOAD_CELL_BASE} px-[0.9rem] w-[3.20rem] shrink-0 flex-none` },
  { key: "SUN", className: `${WORKLOAD_CELL_BASE} px-[0.9rem] w-[3.3rem] shrink-0 flex-none` },
  { key: "TOTAL", className: `${WORKLOAD_CELL_BASE} border-r-0 px-[0.9rem] w-[3.9rem] shrink-0 flex-none` },
];'''

CONSTANTS_NEW = '''const WORKLOAD_CELL_BASE = "fw-workload-cell";

// Heights aligned to EXTRA TEACHING LOADS FOR HONORARIUM (2.15rem header, 2rem data rows)
const WORKLOAD_HEIGHT_DAY_HEADER = "fw-h-day-header";
const WORKLOAD_HEIGHT_REGULAR = "fw-h-regular";
const WORKLOAD_HEIGHT_PAIR = "fw-h-pair";
const WORKLOAD_HEIGHT_OTHER_FUNCTIONS = "fw-h-other-fn";
const WORKLOAD_HEIGHT_OTHER_FUNCTIONS_GROUP = "fw-h-other-fn-group";
const WORKLOAD_HEIGHT_TOTAL = "fw-h-total";

const WORKLOAD_LABEL_WIDTH = "fw-w-label";
const WORKLOAD_OTHER_GROUP_WIDTH = "fw-w-other-group";
const WORKLOAD_OTHER_SUBLABEL_WIDTH = "fw-w-other-sublabel";

const WORKLOAD_DAY_COLUMNS = [
  { key: "MON", className: `${WORKLOAD_CELL_BASE} fw-day-mon` },
  { key: "TUE", className: `${WORKLOAD_CELL_BASE} fw-day-tue` },
  { key: "WED", className: `${WORKLOAD_CELL_BASE} fw-day-wed` },
  { key: "THU", className: `${WORKLOAD_CELL_BASE} fw-day-thu` },
  { key: "FRI", className: `${WORKLOAD_CELL_BASE} fw-day-fri` },
  { key: "SAT", className: `${WORKLOAD_CELL_BASE} fw-day-sat` },
  { key: "SUN", className: `${WORKLOAD_CELL_BASE} fw-day-sun` },
  { key: "TOTAL", className: `${WORKLOAD_CELL_BASE} fw-day-total` },
];'''

IMPORT_LINE = 'import "./FacultyWorkload.css";\n'


def main():
    text = FILE.read_text(encoding="utf-8")

    if CONSTANTS_OLD in text:
        text = text.replace(CONSTANTS_OLD, CONSTANTS_NEW)
    else:
        print("WARNING: constants block not found exactly")

    if IMPORT_LINE.strip() not in text:
        text = text.replace(
            'import API_BASE_URL from "../apiConfig";',
            'import API_BASE_URL from "../apiConfig";\nimport "./FacultyWorkload.css";',
        )

    for old, new in REPLACEMENTS:
        text = text.replace(old, new)

    # Fix prof-details that got double class from w-[48rem] replacement
    text = text.replace(
        "fw-w-48rem fw-mt-08rem prof-details fw-mt-08rem",
        "fw-w-48rem fw-mt-08rem prof-details",
    )
    text = text.replace('className="w-[48rem] prof-details mt-[0.8rem]"', 'className="fw-w-48rem prof-details fw-mt-08rem"')

    # Fix m-0 p-0 day column template
    text = text.replace('className={`m-0 p-0 ${day', 'className={`fw-m-0 fw-p-0 ${day')

    # Remaining thead
    text = text.replace('className="bg-[#c0c0c0]"', 'className="fw-thead-gray"')
    text = text.replace('className="flex align-center"', 'className="fw-flex fw-items-center"')

    # Clean up duplicate spaces in classNames
    import re
    text = re.sub(r'className="([^"]*)"', lambda m: 'className="' + ' '.join(m.group(1).split()) + '"', text)

    FILE.write_text(text, encoding="utf-8")
    print("Conversion complete.")

    # Report remaining tailwind-like patterns
    remaining = re.findall(r'className="[^"]*(?:\[[^\]]+\]|bg-gray|flex-col|items-center)[^"]*"', text)
    print(f"Remaining suspicious classNames: {len(remaining)}")
    for r in remaining[:20]:
        print(" ", r[:120])


if __name__ == "__main__":
    main()
