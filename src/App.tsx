import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import logo from "@/imports/1cg-logo-1.png";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "checklist" | "report" | "taskboard" | "calendar" | "dashboard" | "byjob" | "tools";
type TaskStatus = "todo" | "inprogress" | "done";
type RepeatRule = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly" | "custom";

interface Task {
  id: number;
  text: string;
  column: TaskStatus;
  dueDate: string;
  urgent: boolean;
  important: boolean;
  pinned: boolean;
  assignee: string;
  repeat: RepeatRule;
  customInterval: number;
  customUnit: "day" | "week" | "month";
  job: string;
  checklistWeek?: string;
  checklistIdx?: number;
  onBoard?: boolean;
}

interface JobSite {
  id: string;
  name: string;
  color: string;
  turnoverDate: string;
  archived: boolean;
}

interface AppState {
  jobs: JobSite[];
  tasks: Task[];
  activeJobId: string;
  activeUser: string;
  navOrder: Tab[];
  // checklistDone: "jobId|weekId|taskId" -> bool
  checklistDone: Record<string, boolean>;
  // reportDraft: jobId -> fieldKey -> value
  reportDrafts: Record<string, Record<string, string>>;
  // reportArchives: jobId -> [{id, date, data}]
  reportArchives: Record<string, Array<{ id: number; date: string; data: Record<string, string> }>>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "onecg-job-site-tool-v1";
const TODAY = "2026-09-11";

const JOB_COLORS = [
  "#1D4ED8", // Cobalt blue
  "#0891B2", // Cyan
  "#16A34A", // Emerald green
  "#7C3AED", // Violet
  "#F59E0B", // Golden amber
  "#EA580C", // Burnt orange
  "#0E7490", // Dark cyan
  "#9333EA", // Purple
  "#15803D", // Forest green
  "#D97706", // Deep amber
  "#1E40AF", // Indigo
  "#0F766E", // Teal
];

const NAV_TABS: { id: Tab; label: string }[] = [
  { id: "checklist", label: "Milestone Checklist" },
  { id: "report", label: "Weekly Status Report" },
  { id: "taskboard", label: "Task Board" },
  { id: "calendar", label: "Calendar" },
  { id: "dashboard", label: "Dashboard" },
  { id: "byjob", label: "By Job" },
  { id: "tools", label: "Tools" },
];

const REPEAT_LABELS: Record<RepeatRule, string> = {
  none: "Does not repeat", daily: "Daily", weekdays: "Weekdays",
  weekly: "Weekly", monthly: "Monthly", yearly: "Yearly", custom: "Custom",
};

const STATES = ["North Carolina", "South Carolina", "Georgia", "Tennessee", "Virginia", "Florida"];

// ─── Initial data ─────────────────────────────────────────────────────────────
const INITIAL_JOBS: JobSite[] = [
  { id: "j1", name: "Fort Mill HS",    color: "#16A34A", turnoverDate: "2026-08-14", archived: false },
  { id: "j2", name: "South Asheboro",  color: "#1D4ED8", turnoverDate: "2026-09-30", archived: false },
  { id: "j3", name: "Hartsville MS",   color: "#7C3AED", turnoverDate: "2026-10-15", archived: false },
  { id: "j4", name: "Rock Hill HS",    color: "#EA580C", turnoverDate: "2026-11-01", archived: false },
  { id: "j5", name: "Greenville Tech", color: "#0891B2", turnoverDate: "2026-12-01", archived: false },
];

const INITIAL_TASKS: Task[] = [
  { id: 1,  text: "Door stops completed 8/24, install week of 8/24", column: "inprogress", dueDate: "2026-08-24", job: "j1", urgent: false, important: true,  pinned: false, assignee: "u1", repeat: "none",   customInterval: 1, customUnit: "week" },
  { id: 2,  text: "Replace door jamb on east corridor entrance",      column: "todo",       dueDate: "2026-08-21", job: "j1", urgent: false, important: false, pinned: false, assignee: "u1", repeat: "none",   customInterval: 1, customUnit: "week" },
  { id: 3,  text: "Schedule exit hardware inspection",                column: "todo",       dueDate: "2026-09-05", job: "j1", urgent: false, important: false, pinned: false, assignee: "u2", repeat: "weekly", customInterval: 1, customUnit: "week" },
  { id: 4,  text: "Review and complete the punch list — client.",     column: "inprogress", dueDate: "2026-08-28", job: "j2", urgent: true,  important: false, pinned: true,  assignee: "u1", repeat: "none",   customInterval: 1, customUnit: "week" },
  { id: 5,  text: "Review punch list — Owner and Architect.",         column: "todo",       dueDate: "2026-08-28", job: "j2", urgent: false, important: false, pinned: false, assignee: "u1", repeat: "none",   customInterval: 1, customUnit: "week" },
  { id: 6,  text: "Submit RFI for revised door schedule",             column: "todo",       dueDate: "2026-09-10", job: "j3", urgent: false, important: true,  pinned: false, assignee: "u1", repeat: "none",   customInterval: 1, customUnit: "week" },
  { id: 7,  text: "Coordinate electrician for power door operators",  column: "todo",       dueDate: "2026-09-15", job: "j1", urgent: false, important: false, pinned: false, assignee: "u2", repeat: "none",   customInterval: 1, customUnit: "week" },
  { id: 8,  text: "Final walkthrough with GC",                        column: "done",       dueDate: "2026-08-10", job: "j1", urgent: false, important: false, pinned: false, assignee: "u1", repeat: "none",   customInterval: 1, customUnit: "week" },
  { id: 9,  text: "Submit closeout package",                          column: "done",       dueDate: "2026-08-15", job: "j2", urgent: false, important: false, pinned: false, assignee: "u1", repeat: "none",   customInterval: 1, customUnit: "week" },
  { id: 10, text: "Safety walkthrough — site perimeter",              column: "todo",       dueDate: "2026-09-18", job: "j1", urgent: false, important: false, pinned: false, assignee: "u2", repeat: "weekly", customInterval: 1, customUnit: "week" },
];

// Milestone checklist template — sourced from "Guideline for Project Milestones and Deliverables"
// offset = weeks from turnover date (used for date range display); dateLabel overrides computed range for non-week sections
const CHECKLIST_TEMPLATE: { id: string; label: string; offset: number; dateLabel?: string; items: string[] }[] = [
  { id: "w1", label: "Week 1", offset: 0, items: [
    "Client Contact (Phone and Email).",
    "Project set up complete within Procore.",
    "Schedule review.",
    "Specification review.",
    "Scope/Estimating Budget Review.",
    "Buyout (Solidify Scope, Cost then Release ALL shop drawings).",
    "Issue LOI's as scope buyout progresses.",
    "Submittal Requests (all product data, test reports, O&M's, physical samples, warranties, etc.) Physical samples request min of (4) but also per specifications.",
  ]},
  { id: "w2", label: "Week 2", offset: 1, items: [
    "Develop Milestone Schedule (Within 2 weeks of turnover). Smart Sheet is a great tool for this.",
    "Create Submittal Log and send copy to the client for review.",
    "You should have received a lot of the electronic submittals by now so you can populate the submittal while creating the log.",
    "Work on PM material budget as items come in and get worked out.",
    "Complete schedule of values and send to the client for review and approval.",
  ]},
  { id: "w34", label: "Week 3-4", offset: 2, items: [
    "Continue client contact.",
    "Continue contract drawing review (reviewing details in depth.)",
    "Manage building schedule and adjust and apply pressure where needed if needed.",
    "Continue to manage submittals and submittal log.",
    "Submit any RFI's gathered during review.",
    "Send drafter specifics for the drawings for what you want them to include. (glass types, column line dimensions, what items are not by 1CG, what items are by 1CG, what items are by the manufacturer, show dimensions in feet or inches, etc)",
    "Work on PM material budget as items come in and get worked out.",
    "Review submittal items that have come in. Log them and submit as they come in if the project schedule doesn't allow for a complete submittal package at one time.",
    "Set up scheduled date for an internal \"project approach meeting\". Include VP of construction, VP of operations, Safety coordinator, General superintendent, installer if determined, shop manager, estimator and whomever else that you feel is required.",
    "Review and start putting together required information for the internal project approach meeting. Review the 1CG \"project approach guideline\" for assistance with preparation.",
    "Project billings as applicable.",
  ]},
  { id: "w5", label: "Week 5", offset: 4, items: [
    "Continue client contact.",
    "Continue contract drawing review (reviewing details in depth).",
    "Manage building schedule and adjust and apply pressure where needed if needed.",
    "Continue to manage submittals and submittal log.",
    "Work on PM material budget as items come in and get worked out.",
    "All physical samples should be in by now. Review for accuracy, clean and label each sample with our 1CG labels. Reach out to client to find out where they want the physical samples to go. Box them up and get with 1CG admin to get them sent out.",
    "Perform the internal \"project approach meeting\". Make sure accurate detailed notes are taken.",
    "Send out any notes from discussions to the entire team to ensure everyone is on the same page.",
    "If anything from this discussion affects the shop drawings be sure to send those out to the drafter so they can be incorporated.",
  ]},
  { id: "w68", label: "Week 6-8", offset: 5, items: [
    "Continue client contact.",
    "Continue contract drawing review (reviewing details in depth).",
    "Manage building schedule and adjust and apply pressure where needed if needed.",
    "Continue to manage submittals and submittal log.",
    "You should be able to submit all items excluding shop drawings at this point.",
    "Receive 1st submission shops, review and send out for internal constructability review. Refer to the constructability review guideline for this.",
    "Revise shop drawings to reflect any comments from reviews.",
    "Send over any notes to the GC (if any) that require attention from these reviews to start conversations on the path forward.",
  ]},
  { id: "w810", label: "Week 8-10", offset: 7, items: [
    "Prepare all scope items for the project AND turn over to operations for their budget. This turnover should be formal in person to go over the project and any specifics regarding scope and pricing. Refer to the \"Internal Operations Budget Turnover Guideline\".",
    "Continue client contact.",
    "Continue contract drawing review (reviewing details in depth).",
    "Manage building schedule and adjust and apply pressure where needed if needed.",
    "Continue to manage submittals and submittal log.",
    "Submit shop drawings if not already submitted.",
    "Submit any remaining submittals.",
    "Turn in PM final budget that includes operations budget numbers to your department head.",
    "Project billings as applicable.",
  ]},
  { id: "premat", label: "Pre-Material Release", offset: 9, dateLabel: "Pre-Material Release", items: [
    "Shop drawings approved.",
    "Finish selection approved.",
    "Product data approved.",
    "Physical samples approved.",
    "Door hardware schedule and cut sheets approved.",
    "Sequence plan sent to the metal vendor to ensure proper material optimization.",
  ]},
  { id: "premob", label: "Premobilization", offset: 11, dateLabel: "Premobilization", items: [
    "Continue communications with client and internally to ensure the project approach is still on track as planned.",
    "Upon receipt of F&F shops the PM is to present on the project to Field and Fabrication team. Reference the \"field and Fab turnover guideline\" for items to include in this review.",
    "Confirm engineering is completed and incorporated into the field and file shops as applicable.",
    "Order Installation and fabrication supplies required. Make sure to collaborate with the team to ensure everything is captured.",
    "Complete Site Readiness inspections.",
    "Confirm all safety documents, background checks etc. are completed and submitted as applicable.",
    "Confirm internally that the team is on the same page for deliveries and with the frame construction minding the weight and sizes.",
    "Confirm equipment is set up and ready to go.",
    "Confirm laydown are with client.",
  ]},
  { id: "mob", label: "Mobilization", offset: 13, dateLabel: "Mobilization", items: [
    "Project manager, General Superintendent, Safety manager and quality control manager required to be onsite for initial mobilization.",
    "Get through onsite orientation as required by the client.",
    "Review layout items to ensure all control lines, benchmarks etc are established and confirm what they represent in the building.",
    "Go over the starting point and sequence again with the onsite Forman and general contractor to ensure everyone is on the same page.",
    "Review initial installation with the field team and walk through all steps if possible, to ensure the installation is per installation instructions, meets 1CG expectations and the projects intent. 1CGF quality control manager to be engaged in this process.",
  ]},
  { id: "comp5060", label: "50%-60% Completion", offset: 15, dateLabel: "50%–60% Complete", items: [
    "Continue client contact.",
    "Continue contract drawing review (reviewing details in depth.)",
    "Manage building schedule and adjust and apply pressure where needed if needed.",
    "Review the project's completed and remaining scope for comparison with the PM's takeoff and allocated dollars to the budget to ensure accuracy and make any adjustments to the budget necessary for it to be accurate.",
    "Pre-Punch.",
    "Request retain reduction from the client.",
  ]},
  { id: "comp80", label: "80% Completion", offset: 17, dateLabel: "80% Complete", items: [
    "Continue client contact.",
    "Continue contract drawing review (reviewing details in depth.)",
    "Manage building schedule and adjust and apply pressure where needed if needed.",
    "Review the project's completed and remaining scope for comparison with the PM's takeoff and allocated dollars to the budget to ensure accuracy and make any adjustments to the budget necessary for it to be accurate.",
    "Pre-Punch.",
    "Start putting together an exit plan for the project. Reviewing any and all possible loose ends to get ahead of the completion of the project.",
  ]},
  { id: "comp9095", label: "90-95% Completion", offset: 19, dateLabel: "90–95% Complete", items: [
    "Continue client contact.",
    "Continue contract drawing review (reviewing details in depth.)",
    "Manage building schedule and adjust and apply pressure where needed if needed.",
    "Review the project's completed and remaining scope for comparison with the PM's takeoff and allocated dollars to the budget to ensure accuracy and make any adjustments to the budget necessary for it to be accurate.",
    "Pre-Punch.",
    "Confirm the items on the previous exit plan were completed and continue walking the project and adding items as you see fit.",
    "Request retain reduction from the client.",
  ]},
  { id: "comp95100", label: "95-100% Completion", offset: 21, dateLabel: "95–100% Complete", items: [
    "Continue client contact.",
    "Continue contract drawing review (reviewing details in depth.)",
    "Manage building schedule and adjust and apply pressure where needed if needed.",
    "Review the project's completed and remaining scope for comparison with the PM's takeoff and allocated dollars to the budget to ensure accuracy and make any adjustments to the budget necessary for it to be accurate.",
    "Confirm the items on the previous exit plan were completed and continue walking the project and adding items as you see fit to ensure the project is up to 1CG standards.",
    "Review and complete the punch list provided by the client.",
    "Review and complete the punch list provided by the Owner and Architect.",
    "Review project specifications for a refresher on close out documents.",
    "Start putting together all project close outs documentation as required per project specifications. (Follow \"Project Closeout Process Procore\" document.)",
    "Once the substantial completion date is received request all remaining close outs which should be the project specific warranties.",
    "Bill the project out 100%.",
  ]},
  { id: "aftercomp", label: "After Completion", offset: 23, dateLabel: "After Completion", items: [
    "Bill retain 100%.",
  ]},
];

// Stable numeric ID derived from job+week+idx — same inputs always produce same ID.
function checklistTaskId(jobId: string, weekId: string, idx: number): number {
  const str = `cl:${jobId}:${weekId}:${idx}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0; }
  return Math.abs(h) + 1_000_000; // offset so it never collides with Date.now()-based ids
}

// Ensure every checklist item has a matching task for the given job.
// Returns the same array reference if nothing changed (safe for useEffect deps).
function ensureChecklistTasks(job: JobSite, tasks: Task[]): Task[] {
  const toAdd: Task[] = [];
  CHECKLIST_TEMPLATE.forEach(week => {
    week.items.forEach((text, idx) => {
      const stableId = checklistTaskId(job.id, week.id, idx);
      const exists = tasks.some(t => t.id === stableId);
      if (!exists) {
        toAdd.push({
          id: stableId,
          text,
          column: "todo",
          dueDate: "",
          urgent: false,
          important: false,
          pinned: false,
          assignee: "u1",
          repeat: "none",
          customInterval: 1,
          customUnit: "week",
          job: job.id,
          checklistWeek: week.id,
          checklistIdx: idx,
        });
      }
    });
  });
  return toAdd.length > 0 ? [...tasks, ...toAdd] : tasks;
}

// Report fields — short (2-col grid) and long (full-width textareas).
const REPORT_FIELDS_SHORT: { key: string; label: string; type: string }[] = [
  { key: "projectName",    label: "Project Name",    type: "text" },
  { key: "projectManager", label: "Project Manager", type: "text" },
  { key: "awardDate",      label: "Award Date",      type: "date" },
  { key: "dateOfReport",   label: "Date of Report",  type: "date" },
];

const REPORT_FIELDS_LONG: { key: string; label: string }[] = [
  { key: "projectProgress",         label: "Project Progress" },
  { key: "issuesRoadblocks",        label: "Issues/Roadblocks" },
  { key: "stepsToAddress",          label: "Steps Being Taken to Address These Issues" },
  { key: "delaysGC",                label: "Delays — GC" },
  { key: "delays1CG",               label: "Delays — 1CG" },
  { key: "pendingItems1CG",         label: "Pending Items — 1CG" },
  { key: "pendingItemsGC",          label: "Pending Items — GC" },
  { key: "materialLeadTimes",       label: "Materials Lead Times" },
  { key: "schedule",                label: "Schedule (attach or fill out)" },
  { key: "manpowerWorkers",         label: "Manpower — # Workers Currently" },
  { key: "manpowerChanges",         label: "Manpower — Workforce Changes Since Last Report" },
  { key: "equipment",               label: "Equipment" },
  { key: "outstandingSubmittals",   label: "Outstanding Submittals (Current Submittal Log)" },
  { key: "outstandingChangeOrders", label: "Outstanding Change Orders (Current PCO Log)" },
  { key: "additionalComments",      label: "Additional Comments" },
];

// Flat ordered list used for copy/print
const ALL_REPORT_KEYS: { key: string; label: string }[] = [
  ...REPORT_FIELDS_SHORT.map(f => ({ key: f.key, label: f.label })),
  ...REPORT_FIELDS_LONG.map(f => ({ key: f.key, label: f.label })),
];

// ─── Persistence ──────────────────────────────────────────────────────────────
const DEFAULT_STATE: AppState = {
  jobs: INITIAL_JOBS,
  tasks: INITIAL_TASKS,
  activeJobId: "j1",
  activeUser: "u1",
  navOrder: NAV_TABS.map((t) => t.id),
  checklistDone: {},
  reportDrafts: {},
  reportArchives: {},
};

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AppState>;
      // Merge with defaults so any missing field from an older schema gets a safe value
      return {
        jobs:           Array.isArray(p.jobs)   ? p.jobs   : DEFAULT_STATE.jobs,
        tasks:          Array.isArray(p.tasks)  ? p.tasks  : DEFAULT_STATE.tasks,
        activeJobId:    p.activeJobId           ?? DEFAULT_STATE.activeJobId,
        activeUser:     p.activeUser            ?? DEFAULT_STATE.activeUser,
        navOrder:       Array.isArray(p.navOrder) ? p.navOrder : DEFAULT_STATE.navOrder,
        checklistDone:  p.checklistDone         ?? {},
        reportDrafts:   p.reportDrafts          ?? {},
        reportArchives: p.reportArchives        ?? {},
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_STATE };
}

function saveState(s: AppState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function isOverdue(task: Task): boolean {
  return !!task.dueDate && task.column !== "done" && task.dueDate < TODAY;
}

function nextDueDate(dueDate: string, repeat: RepeatRule, customInterval: number, customUnit: "day" | "week" | "month"): string {
  const d = new Date(dueDate + "T00:00:00");
  switch (repeat) {
    case "daily":    d.setDate(d.getDate() + 1); break;
    case "weekdays": d.setDate(d.getDate() + 1); while ([0,6].includes(d.getDay())) d.setDate(d.getDate() + 1); break;
    case "weekly":   d.setDate(d.getDate() + 7); break;
    case "monthly":  d.setMonth(d.getMonth() + 1); break;
    case "yearly":   d.setFullYear(d.getFullYear() + 1); break;
    case "custom":
      if (customUnit === "day")   d.setDate(d.getDate() + customInterval);
      if (customUnit === "week")  d.setDate(d.getDate() + customInterval * 7);
      if (customUnit === "month") d.setMonth(d.getMonth() + customInterval);
      break;
    default: break;
  }
  return d.toISOString().slice(0, 10);
}

function repeatLabel(t: Task): string {
  if (t.repeat === "none") return "";
  if (t.repeat === "custom") return `Every ${t.customInterval} ${t.customUnit}${t.customInterval !== 1 ? "s" : ""}`;
  return REPEAT_LABELS[t.repeat];
}

function weekDateRange(turnoverDate: string, weekOffset: number): string {
  const base = new Date(turnoverDate + "T00:00:00");
  const start = new Date(base);
  start.setDate(base.getDate() + weekOffset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth()+1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
  return `Mon, ${fmt(start)} – Sun, ${fmt(end)}`;
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const USERS = [
  { id: "u1", name: "User 1 (Master)", role: "Master" as const },
  { id: "u2", name: "User 2",          role: "Member" as const },
  { id: "u3", name: "User 3",          role: "Member" as const },
];

function userName(uid: string) { return USERS.find(u => u.id === uid)?.name ?? uid; }

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--muted-text)", letterSpacing: "1px", textTransform: "uppercase" }}>{children}</span>;
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function handleEnter() {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top - 6 });
    }
    setShow(true);
  }

  return (
    <div ref={ref} className="relative inline-flex" onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="fixed z-[300] pointer-events-none px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-lg whitespace-nowrap"
          style={{ background: "rgba(28,28,30,0.92)", backdropFilter: "blur(4px)", left: pos.x, top: pos.y, transform: "translate(-50%, -100%)" }}>
          {label}
          <div style={{ position: "absolute", left: "50%", bottom: -4, transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: "4px solid rgba(28,28,30,0.92)" }} />
        </div>
      )}
    </div>
  );
}

function RedBtn({ children, onClick, className = "", style: s = {} }: { children: React.ReactNode; onClick?: () => void; className?: string; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={onClick} className={`text-white font-bold cursor-pointer border-none text-sm rounded-lg px-4 py-2 ${className}`}
      style={{ background: "linear-gradient(180deg,#f4474d 0%,#EC2027 50%,#cf1a20 100%)", fontFamily: "var(--font-main)", ...s }}>
      {children}
    </button>
  );
}

function OutBtn({ children, onClick, className = "", active = false }: { children: React.ReactNode; onClick?: () => void; className?: string; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`cursor-pointer text-sm font-semibold rounded-lg px-4 py-1.5 transition-all ${className}`}
      style={{ border: "1.5px solid var(--card-border)", background: active ? "#1c1c1e" : "white", color: active ? "white" : "var(--body-text)", fontFamily: "var(--font-main)" }}>
      {children}
    </button>
  );
}

function SegBtn({ children, onClick, active = false }: { children: React.ReactNode; onClick?: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="cursor-pointer px-3 py-1.5 text-xs font-bold border-none transition-all"
      style={{ background: active ? "linear-gradient(180deg,#f4474d 0%,#EC2027 50%,#cf1a20 100%)" : "white", color: active ? "white" : "var(--body-text)", fontFamily: "var(--font-main)" }}>
      {children}
    </button>
  );
}

// ─── New Job Modal ────────────────────────────────────────────────────────────
function NewJobModal({ onAdd, onClose, usedColors }: { onAdd: (name: string, color: string, turnoverDate: string) => void; onClose: () => void; usedColors: string[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(JOB_COLORS.find(c => !usedColors.includes(c)) ?? JOB_COLORS[0]);
  const [turnoverDate, setTurnoverDate] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd(name.trim(), color, turnoverDate);
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose}>
      <div className="rounded-2xl bg-white p-6 flex flex-col gap-4" style={{ width: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.18)", border: "1.5px solid var(--card-border)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-base" style={{ color: "var(--body-text)" }}>New Job Site</span>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-100 text-lg border-none bg-transparent" style={{ color: "var(--muted-text)" }}>×</button>
        </div>
        <div>
          <SectionLabel>Job Site Name</SectionLabel>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="e.g. Mooresville HS" className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }} />
        </div>
        <div>
          <SectionLabel>Turnover Date</SectionLabel>
          <input type="date" value={turnoverDate} onChange={e => setTurnoverDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }} />
        </div>
        <div>
          <SectionLabel>Job Color</SectionLabel>
          <div className="flex gap-2 mt-2 flex-wrap">
            {JOB_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} className="rounded-lg cursor-pointer transition-all"
                style={{ width: 28, height: 28, background: c, border: color === c ? "3px solid #333" : "2px solid transparent", outline: color === c ? "2px solid white" : "none", outlineOffset: "-4px" }} />
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <OutBtn onClick={onClose}>Cancel</OutBtn>
          <RedBtn onClick={submit}>Add Job Site</RedBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, jobs, onUpdate, onDelete, onFlash, flashId }: {
  task: Task; jobs: JobSite[];
  onUpdate: (id: number, patch: Partial<Task>) => void;
  onDelete: (id: number) => void;
  onFlash?: (id: number) => void;
  flashId?: number | null;
}) {
  const over = isOverdue(task);
  const label = repeatLabel(task);
  const isDark = over;
  const fg = isDark ? "white" : "var(--body-text)";
  const fg2 = isDark ? "rgba(255,255,255,0.65)" : "var(--muted-text)";
  const isFlashing = flashId === task.id;
  const userObj = USERS.find(u => u.id === task.assignee);

  function handleDone() {
    if (task.column === "done" && task.repeat !== "none") {
      // rolling: advance due date, snap back to todo
      const newDue = task.dueDate ? nextDueDate(task.dueDate, task.repeat, task.customInterval, task.customUnit) : task.dueDate;
      onUpdate(task.id, { column: "todo", dueDate: newDue });
    } else {
      onUpdate(task.id, { column: task.column === "done" ? "todo" : task.column === "todo" ? "inprogress" : "done" });
    }
  }

  return (
    <div
      className={`rounded-xl p-3 task-card-shadow transition-all${isFlashing ? " task-flash" : ""}`}
      style={{
        background: over ? "var(--overdue-bg)" : "white",
        border: over ? "none" : "1.5px solid var(--card-border)",
      }}
    >
      <div className="flex items-start gap-2 mb-1">
        {/* Assignee initials badge */}
        {userObj && (
          <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
            style={{ background: isDark ? "rgba(255,255,255,0.2)" : "var(--card-border)", color: fg, fontSize: 9 }}>
            {initials(userObj.name)}
          </div>
        )}
        <span className="flex-1 text-sm font-semibold leading-snug" style={{ color: fg }}>{task.text}</span>
        <div className="flex gap-1 flex-shrink-0 ml-1">
          <Tip label={task.pinned ? "Unpin task — removes from top of column" : "Pin task — keeps it at the top of its column"}>
            <button type="button" onClick={() => onUpdate(task.id, { pinned: !task.pinned })}
              className="w-6 h-6 rounded flex items-center justify-center cursor-pointer border-none"
              style={{ background: task.pinned ? "#F5A623" : isDark ? "rgba(255,255,255,0.1)" : "#f0f0f0", fontSize: 11 }}>📌</button>
          </Tip>
          <Tip label="Delete task — permanently removes it">
            <button type="button" onClick={() => onDelete(task.id)}
              className="w-6 h-6 rounded flex items-center justify-center cursor-pointer border-none text-lg font-bold"
              style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#f0f0f0", color: isDark ? "white" : "var(--muted-text)", lineHeight: 1 }}>×</button>
          </Tip>
        </div>
      </div>

      {/* Status + due date row */}
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <button type="button" onClick={handleDone}
          className="text-xs font-bold px-2 py-0.5 rounded cursor-pointer border-none transition-all"
          style={{ background: task.column === "done" ? "#2E7D32" : isDark ? "rgba(255,255,255,0.18)" : "#eee", color: task.column === "done" ? "white" : fg }}>
          {task.column === "todo" ? "To Do" : task.column === "inprogress" ? "In Progress" : "Done ✓"}
        </button>
        {task.dueDate && (
          <input type="date" value={task.dueDate} onChange={e => onUpdate(task.id, { dueDate: e.target.value })}
            className="text-xs bg-transparent border-none outline-none cursor-pointer"
            style={{ color: fg2, fontFamily: "var(--font-main)" }} />
        )}
        {over && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>OVERDUE</span>}
      </div>

      {/* Tags row */}
      <div className="flex gap-1 mt-1.5 flex-wrap items-center">
        {task.checklistWeek && (
          <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: isDark ? "rgba(255,255,255,0.15)" : "#e8f5e9", color: isDark ? "white" : "#2E7D32" }}>
            ✓ Checklist
          </span>
        )}
        {task.urgent && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: "var(--brand-red)", color: "white" }}>Urgent</span>}
        {task.important && <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: "#444", color: "white" }}>Important</span>}
        {label && (
          <span className="text-xs px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5" style={{ background: isDark ? "rgba(255,255,255,0.15)" : "#e8e8e8", color: fg2 }}>
            ↻ {label}
          </span>
        )}
        {/* Job chip */}
        <span className="text-xs px-1.5 py-0.5 rounded font-bold ml-auto" style={{ background: jobs.find(j => j.id === task.job)?.color ?? "#555", color: "white" }}>
          {jobs.find(j => j.id === task.job)?.name.split(" ")[0] ?? ""}
        </span>
      </div>
    </div>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
function TopBar({ search, setSearch, onSearchSelect, tasks, jobs }: {
  search: string; setSearch: (s: string) => void;
  onSearchSelect: (taskId: number) => void;
  tasks: Task[]; jobs: JobSite[];
}) {
  const [open, setOpen] = useState(false);
  const results = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return tasks.filter(t => t.text.toLowerCase().includes(q)).slice(0, 8);
  }, [search, tasks]);

  return (
    <header className="flex-shrink-0 relative" style={{ zIndex: 30 }}>
      <img src={logo} alt="1CG Job Site Tool" style={{ width: "100%", height: "auto", display: "block" }} />
      {/* Global search overlay */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col" style={{ width: 260, zIndex: 40, top: 28 }}>
        <div className="relative">
          <input
            value={search} onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search tasks..."
            className="w-full pl-3 pr-8 py-1.5 rounded-lg text-xs bg-white"
            style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)", outline: "none" }}
          />
          {search && (
            <button type="button" onMouseDown={() => { setSearch(""); setOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-xs cursor-pointer border-none bg-transparent hover:bg-gray-100"
              style={{ color: "var(--muted-text)" }}>×</button>
          )}
          {open && results.length > 0 && (
            <div className="absolute top-full mt-1 w-full rounded-xl bg-white py-1 z-50" style={{ border: "1.5px solid var(--card-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
              {results.map(t => {
                const tj = jobs.find(j => j.id === t.job);
                const colLabel = t.column === "todo" ? "To Do" : t.column === "inprogress" ? "In Progress" : "Done";
                return (
                  <button key={t.id} type="button" onMouseDown={() => { onSearchSelect(t.id); setSearch(""); setOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 cursor-pointer border-none bg-transparent block"
                    style={{ fontFamily: "var(--font-main)" }}>
                    <span className="font-semibold block truncate mb-0.5" style={{ color: "var(--body-text)" }}>{t.text}</span>
                    <span className="flex items-center gap-1.5">
                      {tj && <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: tj.color }} />}
                      <span style={{ color: "var(--muted-text)" }}>{tj?.name ?? ""} · {colLabel}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-xs mx-4" style={{ border: "1.5px solid var(--card-border)" }}>
        <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--body-text)" }}>{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm font-semibold cursor-pointer hover:bg-gray-50"
            style={{ border: "1.5px solid var(--card-border)", color: "var(--body-text)" }}>Cancel</button>
          <button type="button" onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-bold cursor-pointer"
            style={{ background: "var(--brand-red)", color: "white", border: "none" }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── Manage Job Sites Modal ───────────────────────────────────────────────────
function ManageJobsModal({ jobs, onClose, onArchive, onDelete }: {
  jobs: JobSite[];
  onClose: () => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState<{ action: "delete" | "archive"; id: string; name: string } | null>(null);

  function doConfirm() {
    if (!confirm) return;
    if (confirm.action === "delete") onDelete(confirm.id);
    else onArchive(confirm.id, !jobs.find(j => j.id === confirm.id)?.archived);
    setConfirm(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" style={{ border: "1.5px solid var(--card-border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1.5px solid var(--card-border)" }}>
          <h2 className="font-bold text-lg" style={{ color: "var(--body-text)" }}>Manage Job Sites</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-xl cursor-pointer border-none bg-transparent hover:bg-gray-100">×</button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
          {jobs.length === 0 && <p className="px-5 py-8 text-sm text-center" style={{ color: "var(--muted-text)" }}>No job sites yet.</p>}
          {jobs.map(job => (
            <div key={job.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid #f0f0f0" }}>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: job.color }} />
              <span className="flex-1 text-sm font-medium" style={{ color: job.archived ? "var(--muted-text)" : "var(--body-text)", textDecoration: job.archived ? "line-through" : "none" }}>{job.name}</span>
              {job.archived && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#f0f0f0", color: "var(--muted-text)" }}>Archived</span>}
              <button type="button"
                onClick={() => setConfirm({ action: "archive", id: job.id, name: job.name })}
                className="text-xs px-3 py-1 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                style={{ border: "1.5px solid var(--card-border)", background: "white", color: "var(--body-text)" }}>
                {job.archived ? "Unarchive" : "Archive"}
              </button>
              <button type="button"
                onClick={() => setConfirm({ action: "delete", id: job.id, name: job.name })}
                className="text-xs px-3 py-1 rounded-full cursor-pointer"
                style={{ border: "1.5px solid var(--brand-red)", background: "white", color: "var(--brand-red)" }}>
                Delete
              </button>
            </div>
          ))}
        </div>
        <div className="px-5 py-3" style={{ borderTop: "1.5px solid var(--card-border)" }}>
          <button type="button" onClick={onClose}
            className="w-full py-2 rounded-xl text-sm font-semibold cursor-pointer hover:bg-gray-50"
            style={{ border: "1.5px solid var(--card-border)", color: "var(--body-text)" }}>Close</button>
        </div>
      </div>
      {confirm && (
        <ConfirmDialog
          message={confirm.action === "delete"
            ? `Delete "${confirm.name}"? This cannot be undone and will remove all associated tasks.`
            : `${jobs.find(j => j.id === confirm.id)?.archived ? "Unarchive" : "Archive"} "${confirm.name}"?`}
          onConfirm={doConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ activeTab, setActiveTab, jobs, activeJobId, setActiveJobId, activeUser, setActiveUser, navOrder, onNewJob, onExport, onImport, onManageJobs }: {
  activeTab: Tab; setActiveTab: (t: Tab) => void;
  jobs: JobSite[]; activeJobId: string; setActiveJobId: (id: string) => void;
  activeUser: string; setActiveUser: (u: string) => void;
  navOrder: Tab[]; onNewJob: () => void;
  onExport: () => void; onImport: () => void; onManageJobs: () => void;
}) {
  const orderedTabs = navOrder.map(id => NAV_TABS.find(t => t.id === id)!).filter(Boolean);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  return (
    <aside className="flex-shrink-0 flex flex-col py-3 px-3"
      style={{ width: 220, borderRight: "1px solid var(--card-border)", background: "linear-gradient(180deg,#f7f7f8 0%,#f1f1f3 100%)", overflow: "visible" }}>

      {/* Job selector + ⋯ menu */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <SectionLabel>Job Site</SectionLabel>
          <div className="relative" ref={moreRef}>
            <button type="button" onClick={() => setMoreOpen(v => !v)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-sm cursor-pointer border-none hover:bg-gray-200"
              style={{ background: moreOpen ? "#e5e5e5" : "transparent", color: "var(--muted-text)", letterSpacing: 1 }}
              title="More options">⋯</button>
            {moreOpen && (
              <div className="fixed z-[200] rounded-xl bg-white py-2 shadow-xl"
                style={{ width: 190, border: "1.5px solid var(--card-border)",
                  left: moreRef.current ? moreRef.current.getBoundingClientRect().left : 0,
                  top: moreRef.current ? moreRef.current.getBoundingClientRect().bottom + 6 : 0 }}>
                <p className="px-3 py-1 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>Data</p>
                <button type="button" className="w-full text-left px-3 py-2 text-sm cursor-pointer border-none bg-transparent hover:bg-gray-50"
                  style={{ fontFamily: "var(--font-main)", color: "var(--body-text)" }}
                  onClick={() => { setMoreOpen(false); onExport(); }}>⬇ Export Backup</button>
                <button type="button" className="w-full text-left px-3 py-2 text-sm cursor-pointer border-none bg-transparent hover:bg-gray-50"
                  style={{ fontFamily: "var(--font-main)", color: "var(--body-text)" }}
                  onClick={() => { setMoreOpen(false); onImport(); }}>⬆ Import Backup</button>
                <div style={{ height: 1, background: "#f0f0f0", margin: "4px 0" }} />
                <p className="px-3 py-1 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>Job Sites</p>
                <button type="button" className="w-full text-left px-3 py-2 text-sm cursor-pointer border-none bg-transparent hover:bg-gray-50"
                  style={{ fontFamily: "var(--font-main)", color: "var(--body-text)" }}
                  onClick={() => { setMoreOpen(false); onManageJobs(); }}>⚙ Manage Job Sites</button>
              </div>
            )}
          </div>
        </div>
        <select value={activeJobId} onChange={e => setActiveJobId(e.target.value)}
          className="w-full px-2 py-1.5 rounded-lg text-sm font-medium bg-white cursor-pointer"
          style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }}>
          {jobs.filter(j => !j.archived).map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
        </select>
      </div>

      <RedBtn onClick={onNewJob} className="w-full text-center justify-center flex-shrink-0">+ New Job Site</RedBtn>

      <select value={activeUser} onChange={e => setActiveUser(e.target.value)}
        className="w-full px-2 py-1.5 rounded-lg text-sm font-medium bg-white cursor-pointer flex-shrink-0"
        style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }}>
        {USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>

      <div className="flex flex-col gap-0.5 mt-1 overflow-y-auto flex-1">
        {orderedTabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all border-none flex-shrink-0"
            style={{
              fontFamily: "var(--font-main)",
              background: activeTab === tab.id ? "linear-gradient(180deg,#f4474d 0%,#EC2027 50%,#cf1a20 100%)" : "transparent",
              color: activeTab === tab.id ? "white" : "var(--body-text)",
            }}>
            {tab.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

// ─── Milestone Checklist ──────────────────────────────────────────────────────
type SendModal = { weekId: string; idx: number; text: string } | null;

function MilestoneChecklist({ job, tasks, onUpdateTask, onAddTask, updateJob }: {
  job: JobSite;
  tasks: Task[];
  onUpdateTask: (id: number, patch: Partial<Task>) => void;
  onAddTask: (t: Partial<Task>) => void;
  updateJob: (id: string, patch: Partial<JobSite>) => void;
}) {
  const [sendModal, setSendModal] = useState<SendModal>(null);
  const [modalDue, setModalDue] = useState("");
  const [modalUrgent, setModalUrgent] = useState(false);
  const [modalImportant, setModalImportant] = useState(false);

  function getTask(weekId: string, idx: number) {
    const stableId = checklistTaskId(job.id, weekId, idx);
    return (tasks ?? []).find(t => t.id === stableId);
  }

  function openSendModal(weekId: string, idx: number, text: string) {
    const task = getTask(weekId, idx);
    setModalDue(task?.dueDate ?? "");
    setModalUrgent(task?.urgent ?? false);
    setModalImportant(task?.important ?? false);
    setSendModal({ weekId, idx, text });
  }

  function commitSendToBoard() {
    if (!sendModal) return;
    const { weekId, idx, text } = sendModal;
    const stableId = checklistTaskId(job.id, weekId, idx);
    const existing = (tasks ?? []).find(t => t.id === stableId);
    if (existing) {
      onUpdateTask(existing.id, { dueDate: modalDue, urgent: modalUrgent, important: modalImportant, onBoard: true });
    } else {
      onAddTask({ id: stableId, text, column: "todo", dueDate: modalDue, urgent: modalUrgent, important: modalImportant, job: job.id, checklistWeek: weekId, checklistIdx: idx, onBoard: true });
    }
    setSendModal(null);
  }

  function toggleCheck(weekId: string, idx: number, text: string, checked: boolean) {
    const stableId = checklistTaskId(job.id, weekId, idx);
    const existing = (tasks ?? []).find(t => t.id === stableId);
    if (existing) {
      onUpdateTask(existing.id, { column: checked ? "done" : "todo" });
    } else if (checked) {
      onAddTask({ id: stableId, text, column: "done", job: job.id, checklistWeek: weekId, checklistIdx: idx });
    }
  }

  const totalItems = CHECKLIST_TEMPLATE.reduce((a, w) => a + w.items.length, 0);
  const doneItems = CHECKLIST_TEMPLATE.reduce((a, w) =>
    a + w.items.filter((_, i) => getTask(w.id, i)?.column === "done").length, 0);

  const [selectedColor, setSelectedColor] = useState(job.color);

  return (
    <div className="flex flex-col gap-4 p-5 overflow-y-auto h-full">
      {/* Job header */}
      <div className="rounded-xl p-4 bg-white section-card-shadow flex-shrink-0" style={{ border: "1.5px solid var(--card-border)" }}>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <SectionLabel>Job Site Name</SectionLabel>
            <div className="mt-1 text-2xl font-bold" style={{ color: "var(--body-text)" }}>{job.name}</div>
            <div style={{ borderBottom: "2px solid var(--brand-red)", marginTop: 4 }} />
          </div>
          <div>
            <SectionLabel>Turnover Date</SectionLabel>
            <input type="date" value={job.turnoverDate} onChange={e => updateJob(job.id, { turnoverDate: e.target.value })}
              className="mt-1 px-2 py-1 rounded text-sm w-full"
              style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }} />
          </div>
        </div>
        <div className="mb-3">
          <SectionLabel>Job Color</SectionLabel>
          <div className="flex gap-2 mt-2 flex-wrap">
            {JOB_COLORS.map(c => (
              <button key={c} type="button" onClick={() => { setSelectedColor(c); updateJob(job.id, { color: c }); }}
                className="rounded-lg cursor-pointer transition-all"
                style={{ width: 28, height: 28, background: c, border: selectedColor === c ? "3px solid #333" : "2px solid transparent", outline: selectedColor === c ? "2px solid white" : "none", outlineOffset: "-4px" }} />
            ))}
          </div>
        </div>
        {/* Overall progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 14, background: "#e5e5e5", border: "1px solid #ccc" }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${totalItems > 0 ? (doneItems / totalItems) * 100 : 0}%`, background: "linear-gradient(90deg,#f4474d,#EC2027)" }} />
          </div>
          <span className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--muted-text)" }}>{doneItems} / {totalItems} complete</span>
        </div>
      </div>

      {/* Week cards */}
      {CHECKLIST_TEMPLATE.map(week => {
        const weekDone = week.items.filter((_, i) => getTask(week.id, i)?.column === "done").length;
        const dateRange = week.dateLabel ?? weekDateRange(job.turnoverDate, week.offset);
        return (
          <div key={week.id} className="rounded-xl overflow-hidden section-card-shadow flex-shrink-0" style={{ border: "2px solid var(--card-border)" }}>
            <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "linear-gradient(180deg,#f4474d 0%,#EC2027 50%,#cf1a20 100%)" }}>
              <div className="flex items-center gap-4">
                <span className="font-bold text-white">{week.label}</span>
                {!week.dateLabel && <span className="text-sm text-white opacity-90">{dateRange}</span>}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => week.items.forEach((item, i) => toggleCheck(week.id, i, item, true))}
                  className="px-3 py-1 text-xs font-bold rounded bg-white cursor-pointer hover:bg-gray-100" style={{ color: "var(--brand-red)" }}>CHECK ALL</button>
                <button type="button" onClick={() => week.items.forEach((_, i) => { const t = getTask(week.id, i); if (t) onUpdateTask(t.id, { column: "todo" }); })}
                  className="px-3 py-1 text-xs font-bold rounded bg-white cursor-pointer hover:bg-gray-100" style={{ color: "var(--muted-text)" }}>CLEAR</button>
              </div>
            </div>
            <div className="bg-white">
              {week.items.map((item, idx) => {
                const task = getTask(week.id, idx);
                const done = task?.column === "done";
                const inprog = task?.column === "inprogress";
                const isOnBoard = !!task?.onBoard;
                return (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5"
                    style={{ borderBottom: idx < week.items.length - 1 ? "1px solid #f0f0f0" : "none", background: done ? "#fff8f8" : "white" }}>
                    <input type="checkbox" checked={done}
                      onChange={e => toggleCheck(week.id, idx, item, e.target.checked)}
                      className="task-checkbox" />
                    <span className="flex-1 text-sm" style={{ color: done ? "var(--muted-text)" : "var(--body-text)", textDecoration: done ? "line-through" : "none" }}>{item}</span>
                    {inprog && <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ background: "#F5A623", color: "white" }}>In Progress</span>}
                    {isOnBoard && (
                      <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80"
                        style={{ background: "var(--brand-red)", color: "white", border: "2px solid var(--brand-red)" }}
                        onClick={() => openSendModal(week.id, idx, item)}>
                        &#128205; ON BOARD
                      </span>
                    )}
                    <button type="button" onClick={() => openSendModal(week.id, idx, item)}
                      className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full cursor-pointer hover:bg-gray-100 transition-colors"
                      style={{ border: "1.5px solid var(--card-border)", color: "var(--body-text)", background: "white" }}>
                      + Task
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-2 flex justify-between items-center" style={{ background: "#fafafa", borderTop: "1px solid #eee" }}>
              <span className="text-xs" style={{ color: "var(--muted-text)" }}>{weekDone} of {week.items.length} complete</span>
              <div className="rounded-full overflow-hidden" style={{ width: 80, height: 6, background: "#e5e5e5" }}>
                <div className="h-full rounded-full" style={{ width: `${week.items.length > 0 ? (weekDone / week.items.length) * 100 : 0}%`, background: "var(--brand-red)" }} />
              </div>
            </div>
          </div>
        );
      })}

      {/* Send to Task Board modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={e => { if (e.target === e.currentTarget) setSendModal(null); }}>
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm mx-4" style={{ border: "1.5px solid var(--card-border)" }}>
            <h2 className="text-lg font-bold mb-1" style={{ color: "var(--body-text)" }}>Send to Task Board</h2>
            <p className="text-sm mb-4" style={{ color: "var(--muted-text)" }}>{sendModal.text}</p>
            <SectionLabel>Due Date</SectionLabel>
            <input type="date" value={modalDue} onChange={e => setModalDue(e.target.value)}
              className="mt-1 mb-4 w-full px-3 py-2 rounded-lg text-sm"
              style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }} />
            <div className="flex gap-3 mb-6">
              <button type="button" onClick={() => setModalUrgent(v => !v)}
                className="px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-all"
                style={{ border: "1.5px solid " + (modalUrgent ? "var(--brand-red)" : "var(--card-border)"), background: modalUrgent ? "var(--brand-red)" : "white", color: modalUrgent ? "white" : "var(--body-text)" }}>
                Urgent
              </button>
              <button type="button" onClick={() => setModalImportant(v => !v)}
                className="px-4 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-all"
                style={{ border: "1.5px solid " + (modalImportant ? "#555" : "var(--card-border)"), background: modalImportant ? "#444" : "white", color: modalImportant ? "white" : "var(--body-text)" }}>
                Important
              </button>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSendModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ border: "1.5px solid var(--card-border)", color: "var(--body-text)" }}>
                Cancel
              </button>
              <button type="button" onClick={commitSendToBoard}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors"
                style={{ background: "var(--brand-red)", color: "white", border: "none" }}>
                Add to Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Weekly Status Report ─────────────────────────────────────────────────────
function WeeklyStatusReport({ job, tasks, draft, setDraft, archives, onArchive }: {
  job: JobSite;
  tasks: Task[];
  draft: Record<string, string>;
  setDraft: (k: string, v: string) => void;
  archives: Array<{ id: number; date: string; data: Record<string, string> }>;
  onArchive: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"new" | "archive">("new");
  const [copyConfirm, setCopyConfirm] = useState(false);
  const [autofillCount, setAutofillCount] = useState<number | null>(null);
  const [confirmBlank, setConfirmBlank] = useState(false);
  const [expandedArchive, setExpandedArchive] = useState<number | null>(null);
  // track which keys were auto-filled (so we can show the "Auto" pill)
  const [autoKeys, setAutoKeys] = useState<Set<string>>(new Set());

  function autofill() {
    const jobTasks = tasks.filter(t => t.job === job.id);
    const overdue = jobTasks.filter(t => isOverdue(t));
    const thisWeek = jobTasks.filter(t => t.dueDate >= TODAY && t.dueDate <= addDays(TODAY, 6) && t.column !== "done");
    const totalItems = CHECKLIST_TEMPLATE.reduce((a, w) => a + w.items.length, 0);
    const doneItems = tasks.filter(t => t.job === job.id && t.checklistWeek && t.column === "done").length;
    const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    const fills: Record<string, string> = {};
    const touched = new Set<string>();

    function tryFill(key: string, value: string) {
      if (!draft[key] && value) { fills[key] = value; touched.add(key); }
    }

    tryFill("projectName", job.name);
    tryFill("dateOfReport", TODAY);
    tryFill("projectProgress", `${doneItems} of ${totalItems} milestones complete (${pct}%)`);

    if (overdue.length > 0 || thisWeek.length > 0) {
      const lines: string[] = [];
      if (overdue.length > 0) {
        lines.push("Overdue:");
        overdue.forEach(t => lines.push(`  • ${t.text}`));
      }
      if (thisWeek.length > 0) {
        lines.push("Due this week:");
        thisWeek.forEach(t => lines.push(`  • ${t.text}`));
      }
      tryFill("pendingItems1CG", lines.join("\n"));
    }

    Object.entries(fills).forEach(([k, v]) => setDraft(k, v));
    setAutoKeys(prev => new Set([...prev, ...touched]));
    setAutofillCount(touched.size);
    setTimeout(() => setAutofillCount(null), 3000);
  }

  function addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function clearAutoFlag(key: string) {
    setAutoKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
  }

  function copyReport() {
    const lines: string[] = [];
    ALL_REPORT_KEYS.forEach(({ key, label }) => {
      lines.push(label.toUpperCase());
      lines.push(draft[key] ?? "");
      lines.push("");
    });
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopyConfirm(true);
      setTimeout(() => setCopyConfirm(false), 2500);
    }).catch(() => {});
  }

  function printReport() {
    window.print();
  }

  function duplicateArchive(a: { data: Record<string, string> }) {
    ALL_REPORT_KEYS.forEach(({ key }) => {
      if (key === "dateOfReport") { setDraft(key, ""); return; }
      setDraft(key, a.data[key] ?? "");
    });
    setAutoKeys(new Set());
    setActiveTab("new");
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex flex-shrink-0 px-5 pt-4" style={{ borderBottom: "2px solid var(--card-border)" }}>
        {(["new", "archive"] as const).map(t => (
          <button key={t} type="button" onClick={() => setActiveTab(t)}
            className="px-5 py-2 text-sm font-semibold cursor-pointer transition-all bg-transparent border-none"
            style={{ color: activeTab === t ? "var(--body-text)" : "var(--muted-text)", borderBottom: activeTab === t ? "2px solid var(--brand-red)" : "2px solid transparent", marginBottom: -2 }}>
            {t === "new" ? "New Report" : `Archive (${archives.length})`}
          </button>
        ))}
      </div>

      {activeTab === "new" ? (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Action toolbar */}
          <div className="rounded-xl p-4 bg-white section-card-shadow flex flex-wrap items-center gap-3" style={{ border: "1.5px solid var(--card-border)" }}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>Draft for {job.name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-text)" }}>Auto-fill pulls live job data into blank fields only. Save snapshots to Archive without clearing the draft.</p>
            </div>
            <div className="flex gap-2 flex-wrap flex-shrink-0 items-center">
              <div className="relative">
                <RedBtn onClick={autofill}>Auto-fill</RedBtn>
                {autofillCount !== null && (
                  <span className="absolute -top-2 -right-2 text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "#2E7D32", fontSize: 10 }}>{autofillCount}</span>
                )}
              </div>
              <OutBtn onClick={() => setConfirmBlank(true)}>Start blank</OutBtn>
              <OutBtn onClick={onArchive}>Save</OutBtn>
              <div className="relative">
                <OutBtn onClick={copyReport}>{copyConfirm ? "✓ Copied!" : "Copy Report"}</OutBtn>
              </div>
              <OutBtn onClick={printReport}>Print</OutBtn>
            </div>
          </div>

          {/* Short fields — 2-column grid */}
          <div className="rounded-xl bg-white" style={{ border: "1.5px solid var(--card-border)", boxShadow: "0 2px 6px rgba(0,0,0,0.07)" }}>
            <div className="px-4 py-2" style={{ background: "linear-gradient(180deg,#f4474d 0%,#EC2027 50%,#cf1a20 100%)", borderRadius: "10px 10px 0 0" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "white" }}>Project Info</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {REPORT_FIELDS_SHORT.map((f, fi) => {
                const isAuto = autoKeys.has(f.key);
                const isRight = fi % 2 === 1;
                const isBottom = fi >= 2;
                return (
                  <div key={f.key} style={{ padding: "14px 16px", borderLeft: isRight ? "1px solid #f0f0f0" : "none", borderTop: isBottom ? "1px solid #f0f0f0" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#8a8a90" }}>{f.label}</span>
                      {isAuto && (
                        <Tip label="Drafted from job data — edit freely">
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#e8f5e9", color: "#2E7D32", border: "1px solid #c8e6c9", cursor: "pointer" }}
                            onClick={() => clearAutoFlag(f.key)}>Auto ×</span>
                        </Tip>
                      )}
                    </div>
                    <input type={f.type} value={draft[f.key] ?? ""} onChange={e => { setDraft(f.key, e.target.value); clearAutoFlag(f.key); }}
                      placeholder="—"
                      style={{ width: "100%", fontSize: 14, fontFamily: "var(--font-main)", color: "#1c1c1e", background: "transparent", border: "none", outline: "none" }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Long text fields */}
          {REPORT_FIELDS_LONG.map(f => {
            const isAuto = autoKeys.has(f.key);
            return (
              <div key={f.key} className="rounded-xl bg-white" style={{ border: "1.5px solid var(--card-border)", boxShadow: "0 2px 6px rgba(0,0,0,0.07)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderBottom: "1px solid #f0f0f0" }}>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#1c1c1e" }}>{f.label}</span>
                  {isAuto && (
                    <Tip label="Drafted from job data — edit freely">
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#e8f5e9", color: "#2E7D32", border: "1px solid #c8e6c9", cursor: "pointer" }}
                        onClick={() => clearAutoFlag(f.key)}>Auto ×</span>
                    </Tip>
                  )}
                </div>
                <textarea value={draft[f.key] ?? ""}
                  onChange={e => { setDraft(f.key, e.target.value); clearAutoFlag(f.key); }}
                  rows={3} placeholder="Enter notes…"
                  style={{ display: "block", width: "100%", padding: "12px 16px", fontSize: 13, fontFamily: "var(--font-main)", color: "#1c1c1e", background: "transparent", border: "none", outline: "none", resize: "vertical", minHeight: 72, boxSizing: "border-box" }} />
              </div>
            );
          })}

          {/* Bottom action row */}
          <div className="flex gap-2 flex-wrap pb-2">
            <RedBtn onClick={onArchive}>Save to Archive</RedBtn>
            <div className="relative">
              <OutBtn onClick={copyReport}>{copyConfirm ? "✓ Copied to clipboard!" : "Copy Report"}</OutBtn>
            </div>
            <OutBtn onClick={printReport}>Print / PDF</OutBtn>
          </div>
        </div>
      ) : (
        /* Archive tab */
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
          {archives.length === 0 && (
            <div className="rounded-xl p-8 text-center" style={{ border: "2px dashed var(--card-border)" }}>
              <p className="text-sm" style={{ color: "var(--muted-text)" }}>No saved reports yet. Fill out a draft and click Save to Archive.</p>
            </div>
          )}
          {archives.map(a => {
            const isExpanded = expandedArchive === a.id;
            return (
              <div key={a.id} className="rounded-xl bg-white section-card-shadow overflow-hidden" style={{ border: "1.5px solid var(--card-border)" }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  style={{ borderBottom: isExpanded ? "1px solid #f0f0f0" : "none" }}
                  onClick={() => setExpandedArchive(isExpanded ? null : a.id)}>
                  <div>
                    <span className="font-bold text-sm" style={{ color: "var(--body-text)" }}>{a.date}</span>
                    <span className="text-sm ml-2" style={{ color: "var(--muted-text)" }}>— {a.data["projectName"] || job.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <OutBtn onClick={() => duplicateArchive(a)}>Duplicate to draft</OutBtn>
                    <span className="text-sm" style={{ color: "var(--muted-text)" }}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                {/* Expanded rows */}
                {isExpanded && (
                  <div className="px-4 py-3 flex flex-col gap-2">
                    {ALL_REPORT_KEYS.filter(({ key }) => a.data[key]).map(({ key, label }) => (
                      <div key={key}>
                        <div className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-text)" }}>{label}</div>
                        <div className="text-sm whitespace-pre-wrap" style={{ color: "var(--body-text)" }}>{a.data[key]}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {confirmBlank && (
        <ConfirmDialog
          message="Clear the entire draft? This cannot be undone."
          onConfirm={() => { ALL_REPORT_KEYS.forEach(({ key }) => setDraft(key, "")); setAutoKeys(new Set()); setConfirmBlank(false); }}
          onCancel={() => setConfirmBlank(false)}
        />
      )}
    </div>
  );
}

// ─── Task Board ───────────────────────────────────────────────────────────────
function TaskBoard({ tasks, jobs, activeJobId, onUpdateTask, onDeleteTask, onAddTask, flashTaskId }: {
  tasks: Task[]; jobs: JobSite[]; activeJobId: string;
  onUpdateTask: (id: number, patch: Partial<Task>) => void;
  onDeleteTask: (id: number) => void;
  onAddTask: (t: Partial<Task>) => void;
  flashTaskId: number | null;
}) {
  const [jobFilter, setJobFilter] = useState<"thisjob" | "alljobs" | "choosejobs">("thisjob");
  const [weekFilter, setWeekFilter] = useState<"all" | "thisweek">("all");
  const [newTask, setNewTask] = useState({ text: "", dueDate: "", repeat: "none" as RepeatRule, column: "todo" as TaskStatus, job: activeJobId, assignee: "u1", urgent: false, important: false });
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (flashTaskId && flashRef.current) flashRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); }, [flashTaskId]);

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (jobFilter === "thisjob" && t.job !== activeJobId) return false;
      if (t.checklistWeek && !t.onBoard) return false;
      return true;
    }).sort((a, b) => {
      const ao = isOverdue(a) ? 0 : a.pinned ? 1 : 2;
      const bo = isOverdue(b) ? 0 : b.pinned ? 1 : 2;
      return ao - bo;
    });
  }, [tasks, jobFilter, activeJobId]);

  function addTask() {
    if (!newTask.text.trim()) return;
    onAddTask({ ...newTask, id: Date.now() });
    setNewTask(n => ({ ...n, text: "", dueDate: "" }));
  }

  function handleDrop(col: TaskStatus) {
    if (draggingId !== null) onUpdateTask(draggingId, { column: col });
    setDraggingId(null); setDragOver(null);
  }

  const cols: { id: TaskStatus; label: string }[] = [
    { id: "todo", label: "TO DO" },
    { id: "inprogress", label: "IN PROGRESS" },
    { id: "done", label: "DONE" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-3">
      {/* Composer */}
      <div className="rounded-xl p-4 bg-white section-card-shadow flex-shrink-0" style={{ border: "1.5px solid var(--card-border)" }}>
        <SectionLabel>New Task</SectionLabel>
        <div className="mt-2 flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <SectionLabel>Task</SectionLabel>
              <input type="text" placeholder="Describe the task..." value={newTask.text}
                onChange={e => setNewTask(n => ({ ...n, text: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addTask()}
                className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none"
                style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }} />
            </div>
            <div>
              <SectionLabel>Due Date</SectionLabel>
              <input type="date" value={newTask.dueDate} onChange={e => setNewTask(n => ({ ...n, dueDate: e.target.value }))}
                className="w-full mt-1 px-2 py-1.5 rounded text-sm outline-none"
                style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }} />
            </div>
            <div>
              <SectionLabel>Repeat</SectionLabel>
              <select value={newTask.repeat} onChange={e => setNewTask(n => ({ ...n, repeat: e.target.value as RepeatRule }))}
                className="w-full mt-1 px-2 py-1.5 rounded text-sm"
                style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }}>
                {Object.entries(REPEAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <SectionLabel>Column</SectionLabel>
              <select value={newTask.column} onChange={e => setNewTask(n => ({ ...n, column: e.target.value as TaskStatus }))}
                className="mt-1 px-2 py-1.5 rounded text-sm" style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }}>
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div>
              <SectionLabel>Job</SectionLabel>
              <select value={newTask.job} onChange={e => setNewTask(n => ({ ...n, job: e.target.value }))}
                className="mt-1 px-2 py-1.5 rounded text-sm" style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }}>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </div>
            <div>
              <SectionLabel>Assignee</SectionLabel>
              <select value={newTask.assignee} onChange={e => setNewTask(n => ({ ...n, assignee: e.target.value }))}
                className="mt-1 px-2 py-1.5 rounded text-sm" style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }}>
                {USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setNewTask(n => ({ ...n, important: !n.important }))}
                className="px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all"
                style={{ border: "1.5px solid var(--card-border)", background: newTask.important ? "#444" : "white", color: newTask.important ? "white" : "var(--body-text)", fontFamily: "var(--font-main)" }}>
                Important
              </button>
              <button type="button" onClick={() => setNewTask(n => ({ ...n, urgent: !n.urgent }))}
                className="px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition-all"
                style={{ border: "1.5px solid var(--card-border)", background: newTask.urgent ? "var(--brand-red)" : "white", color: newTask.urgent ? "white" : "var(--body-text)", fontFamily: "var(--font-main)" }}>
                Urgent
              </button>
              <RedBtn onClick={addTask} className="px-6">Add Task</RedBtn>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-shrink-0">
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1.5px solid var(--card-border)" }}>
          {(["thisjob","alljobs"] as const).map((f,i) => (
            <SegBtn key={f} active={jobFilter===f} onClick={() => setJobFilter(f)}>
              {f==="thisjob" ? "This Job" : "All Jobs"}
            </SegBtn>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1.5px solid var(--card-border)" }}>
          <SegBtn active={weekFilter==="all"} onClick={() => setWeekFilter("all")}>All Tasks</SegBtn>
          <SegBtn active={weekFilter==="thisweek"} onClick={() => setWeekFilter("thisweek")}>This Week</SegBtn>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-3 flex-1 overflow-hidden min-h-0">
        {cols.map(col => {
          const colTasks = filtered.filter(t => t.column === col.id);
          return (
            <div key={col.id} className="flex-1 flex flex-col rounded-xl overflow-hidden min-w-0"
              style={{ border: dragOver === col.id ? "2px solid var(--brand-red)" : "2px solid var(--card-border)", background: dragOver === col.id ? "#fff5f5" : "#f7f7f8" }}
              onDragOver={e => { e.preventDefault(); setDragOver(col.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(col.id)}>
              <div className="px-4 py-2.5 flex items-center justify-between flex-shrink-0" style={{ background: "white", borderBottom: "1.5px solid var(--card-border)" }}>
                <span className="font-bold text-sm uppercase tracking-wider">{col.label}</span>
                <span className="rounded-full text-xs font-bold px-2 py-0.5"
                  style={{ background: col.id === "done" ? "#2E7D32" : "var(--brand-red)", color: "white" }}>
                  {colTasks.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
                {colTasks.map(task => (
                  <div key={task.id} draggable onDragStart={() => setDraggingId(task.id)} ref={task.id === flashTaskId ? flashRef : null}>
                    <TaskCard task={task} jobs={jobs} onUpdate={onUpdateTask} onDelete={onDeleteTask} flashId={flashTaskId} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
function CalendarView({ tasks, jobs, activeJobId, onTaskClick }: { tasks: Task[]; jobs: JobSite[]; activeJobId: string; onTaskClick: (id: number) => void }) {
  const [month, setMonth] = useState(new Date(2026, 8, 1)); // Sep 2026
  const [jobFilter, setJobFilter] = useState<"thisjob" | "alljobs">("thisjob");
  const [popover, setPopover] = useState<{ date: string; tasks: Task[] } | null>(null);
  const [tooltip, setTooltip] = useState<{ task: Task; x: number; y: number } | null>(null);

  const year = month.getFullYear();
  const mo = month.getMonth();
  const firstDay = new Date(year, mo, 1).getDay();
  const daysInMonth = new Date(year, mo + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const filteredTasks = tasks.filter(t => jobFilter === "alljobs" || t.job === activeJobId);

  function tasksForDay(day: number): Task[] {
    const ds = `${year}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return filteredTasks.filter(t => t.dueDate === ds);
  }

  const DAY_HEADERS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-3">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setMonth(new Date(year, mo-1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer bg-white border-none hover:bg-gray-50"
            style={{ border: "1.5px solid var(--card-border)" }}>‹</button>
          <h2 className="text-lg font-bold" style={{ minWidth: 180, textAlign: "center" }}>{month.toLocaleString("default",{month:"long"})} {year}</h2>
          <button type="button" onClick={() => setMonth(new Date(year, mo+1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer bg-white border-none hover:bg-gray-50"
            style={{ border: "1.5px solid var(--card-border)" }}>›</button>
          <OutBtn onClick={() => setMonth(new Date(2026, 8, 1))}>Today</OutBtn>
        </div>
        <div className="flex rounded-lg overflow-hidden" style={{ border: "1.5px solid var(--card-border)" }}>
          <SegBtn active={jobFilter==="thisjob"} onClick={() => setJobFilter("thisjob")}>This Job</SegBtn>
          <SegBtn active={jobFilter==="alljobs"} onClick={() => setJobFilter("alljobs")}>All Jobs</SegBtn>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden min-h-0">
        {/* Legend */}
        <div className="rounded-xl p-4 bg-white section-card-shadow flex-shrink-0 self-start" style={{ border: "1.5px solid var(--card-border)", width: 150 }}>
          <SectionLabel>Legend</SectionLabel>
          <div className="flex flex-col gap-2 mt-3">
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded border-2 flex-shrink-0" style={{ borderColor: "var(--brand-red)" }} /><span className="text-xs">Overdue</span></div>
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded border-2 flex-shrink-0" style={{ borderColor: "var(--brand-amber)" }} /><span className="text-xs">Due today</span></div>
            {jobs.filter(j => !j.archived).map(j => (
              <div key={j.id} className="flex items-center gap-2"><div className="w-4 h-4 rounded flex-shrink-0" style={{ background: j.color }} /><span className="text-xs truncate">{j.name.split(" ")[0]}</span></div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden rounded-xl" style={{ border: "1.5px solid var(--card-border)", background: "white" }}>
          <div className="grid grid-cols-7 flex-shrink-0" style={{ borderBottom: "1.5px solid var(--card-border)" }}>
            {DAY_HEADERS.map(d => (
              <div key={d} className="text-center py-2 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1 overflow-y-auto" style={{ gridAutoRows: "minmax(70px,1fr)" }}>
            {cells.map((day, idx) => {
              const dt = day ? `${year}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}` : "";
              const dayTasks = day ? tasksForDay(day) : [];
              const isToday = dt === TODAY;
              const isWe = idx % 7 === 0 || idx % 7 === 6;
              const shown = dayTasks.slice(0, 4);
              const more = dayTasks.length - 4;

              return (
                <div key={idx} className="p-1 overflow-hidden relative"
                  style={{ borderRight: idx % 7 < 6 ? "1px solid #f0f0f0" : "none", borderBottom: "1px solid #f0f0f0", background: !day ? "#f9f9f9" : isWe ? "#fafafa" : isToday ? "#fffbf0" : "white" }}>
                  {day && (
                    <>
                      <div className="text-xs font-bold mb-0.5 w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ color: isToday ? "var(--brand-red)" : "var(--body-text)", background: isToday ? "#fff0f0" : "transparent" }}>{day}</div>
                      {shown.map(t => {
                        const job = jobs.find(j => j.id === t.job);
                        const over = isOverdue(t);
                        return (
                          <div key={t.id}
                            className="text-xs px-1 py-0.5 rounded font-semibold truncate mb-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ background: over ? "var(--overdue-bg)" : job?.color ?? "#555", color: "white", fontSize: 10 }}
                            onClick={() => onTaskClick(t.id)}
                            onMouseEnter={e => {
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setTooltip({ task: t, x: r.left, y: r.bottom + 6 });
                            }}
                            onMouseLeave={() => setTooltip(null)}>
                            {t.text}
                          </div>
                        );
                      })}
                      {more > 0 && (
                        <button type="button" onClick={() => setPopover({ date: dt, tasks: dayTasks })}
                          className="text-xs cursor-pointer border-none bg-transparent font-bold" style={{ color: "var(--brand-red)" }}>+{more} more</button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Popover */}
      {popover && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.3)" }} onClick={() => setPopover(null)}>
          <div className="rounded-2xl bg-white p-5 flex flex-col gap-2" style={{ width: 300, boxShadow: "0 8px 40px rgba(0,0,0,0.15)", border: "1.5px solid var(--card-border)" }} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold">{popover.date}</span>
              <button type="button" onClick={() => setPopover(null)} className="w-7 h-7 rounded-full flex items-center justify-center border-none bg-transparent text-lg cursor-pointer hover:bg-gray-100">×</button>
            </div>
            {popover.tasks.map(t => {
              const job = jobs.find(j => j.id === t.job);
              const over = isOverdue(t);
              return (
                <div key={t.id} className="text-sm px-3 py-2 rounded-lg font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ background: over ? "var(--overdue-bg)" : job?.color ?? "#555", color: "white" }}
                  onClick={() => { setPopover(null); onTaskClick(t.id); }}>
                  {t.text}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && (() => {
        const t = tooltip.task;
        const tjob = jobs.find(j => j.id === t.job);
        const over = isOverdue(t);
        const colLabel = t.column === "todo" ? "To Do" : t.column === "inprogress" ? "In Progress" : "Done";
        const colColor = t.column === "done" ? "#2E7D32" : t.column === "inprogress" ? "#F5A623" : "#8a8a90";
        const left = Math.min(tooltip.x, window.innerWidth - 280);
        return (
          <div className="fixed z-50 pointer-events-none rounded-xl shadow-2xl"
            style={{ left, top: tooltip.y, width: 268, background: "white", border: "1.5px solid var(--card-border)" }}>
            {/* Color header strip */}
            <div className="rounded-t-xl px-3 py-2" style={{ background: over ? "var(--overdue-bg)" : tjob?.color ?? "#555" }}>
              <p className="text-white font-bold text-xs truncate leading-snug">{t.text}</p>
            </div>
            <div className="px-3 py-2.5 flex flex-col gap-1.5">
              {/* Job */}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tjob?.color ?? "#555" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--body-text)" }}>{tjob?.name ?? "Unknown Job"}</span>
              </div>
              {/* Column */}
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colColor }} />
                <span className="text-xs" style={{ color: "var(--muted-text)" }}>{colLabel}</span>
                {over && <span className="text-xs font-bold ml-1" style={{ color: "var(--brand-red)" }}>OVERDUE</span>}
              </div>
              {/* Due date */}
              {t.dueDate && (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "var(--muted-text)" }}>Due:</span>
                  <span className="text-xs font-semibold" style={{ color: over ? "var(--brand-red)" : "var(--body-text)" }}>{t.dueDate}</span>
                </div>
              )}
              {/* Flags */}
              {(t.urgent || t.important) && (
                <div className="flex gap-1.5 mt-0.5">
                  {t.urgent && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--brand-red)", color: "white" }}>Urgent</span>}
                  {t.important && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#444", color: "white" }}>Important</span>}
                </div>
              )}
              <p className="text-xs mt-1" style={{ color: "var(--muted-text)" }}>Click to jump to Task Board →</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const size = 160, r = 62;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e5e5" strokeWidth={14} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--brand-red)" strokeWidth={14} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset} className="progress-ring-circle" />
      <text x={size/2} y={size/2-6} textAnchor="middle" fontSize={28} fontWeight={700} fill="var(--body-text)" fontFamily="var(--font-main)">{percent}%</text>
      <text x={size/2} y={size/2+14} textAnchor="middle" fontSize={11} fill="var(--muted-text)" fontFamily="var(--font-main)">{label}</text>
    </svg>
  );
}

function Dashboard({ tasks, jobs, activeJobId }: { tasks: Task[]; jobs: JobSite[]; activeJobId: string }) {
  const [jobFilter, setJobFilter] = useState<"thisjob" | "alljobs">("thisjob");

  const scopeJobs = jobFilter === "thisjob" ? jobs.filter(j => j.id === activeJobId) : jobs.filter(j => !j.archived);
  const scopeTasks = tasks.filter(t => scopeJobs.some(j => j.id === t.job));
  const overdueTasks = scopeTasks.filter(isOverdue);

  const totalItems = CHECKLIST_TEMPLATE.reduce((a, w) => a + w.items.length, 0);
  const doneItems = (jobId: string) => tasks.filter(t => t.job === jobId && t.checklistWeek && t.column === "done").length;

  const pct = totalItems > 0 ? Math.round((doneItems(activeJobId) / totalItems) * 100) : 0;

  const jobRanking = scopeJobs.map(j => ({
    job: j,
    overdue: tasks.filter(t => t.job === j.id && isOverdue(t)).length,
    done: doneItems(j.id),
    pct: totalItems > 0 ? Math.round((doneItems(j.id) / totalItems) * 100) : 0,
  })).sort((a, b) => b.overdue - a.overdue || a.pct - b.pct);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <div className="flex rounded-lg overflow-hidden flex-shrink-0 self-start" style={{ border: "1.5px solid var(--card-border)" }}>
        <SegBtn active={jobFilter==="thisjob"} onClick={() => setJobFilter("thisjob")}>This Job</SegBtn>
        <SegBtn active={jobFilter==="alljobs"} onClick={() => setJobFilter("alljobs")}>All Jobs</SegBtn>
      </div>

      {/* Overdue */}
      <div className="rounded-xl p-5 bg-white section-card-shadow" style={{ border: "1.5px solid var(--card-border)" }}>
        <SectionLabel>Overdue</SectionLabel>
        <div className="flex items-center gap-4 mt-2">
          <div className="text-6xl font-bold" style={{ color: "var(--brand-red)" }}>{overdueTasks.length}</div>
          <div className="text-sm" style={{ color: "var(--muted-text)" }}>Tasks past their due date and not marked Done, for this {jobFilter === "alljobs" ? "selection" : "job"}.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Progress ring */}
        <div className="rounded-xl p-5 bg-white section-card-shadow flex flex-col items-center" style={{ border: "1.5px solid var(--card-border)" }}>
          <SectionLabel>Milestone Progress</SectionLabel>
          <div className="mt-3"><ProgressRing percent={pct} label={`${doneItems(activeJobId)} / ${totalItems}`} /></div>
        </div>

        {/* Per-section bars */}
        <div className="rounded-xl p-5 bg-white section-card-shadow" style={{ border: "1.5px solid var(--card-border)" }}>
          <SectionLabel>Progress by Section</SectionLabel>
          <div className="flex flex-col gap-3 mt-3">
            {CHECKLIST_TEMPLATE.map(w => {
              const d = tasks.filter(t => t.job === activeJobId && t.checklistWeek === w.id && t.column === "done").length;
              const p = w.items.length > 0 ? (d / w.items.length) * 100 : 0;
              return (
                <div key={w.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold">{w.label}</span>
                    <span style={{ color: "var(--muted-text)" }}>{d}/{w.items.length}</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 8, background: "#eee" }}>
                    <div className="h-full rounded-full" style={{ width: `${p}%`, background: d === w.items.length ? "#2E7D32" : "var(--brand-red)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Job ranking */}
      {jobFilter === "alljobs" && (
        <div className="rounded-xl p-5 bg-white section-card-shadow" style={{ border: "1.5px solid var(--card-border)" }}>
          <SectionLabel>Jobs by Risk</SectionLabel>
          <div className="flex flex-col gap-2 mt-3">
            {jobRanking.map(({ job, overdue, pct }) => (
              <div key={job.id} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: job.color }} />
                <span className="text-sm font-semibold flex-1">{job.name}</span>
                {overdue > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "var(--overdue-bg)", color: "white" }}>{overdue} overdue</span>}
                <span className="text-xs font-bold" style={{ color: "var(--muted-text)", minWidth: 40, textAlign: "right" }}>{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── By Job ───────────────────────────────────────────────────────────────────
function ByJob({ tasks, jobs, onUpdateTask, onDeleteTask, onAddTask }: {
  tasks: Task[]; jobs: JobSite[];
  onUpdateTask: (id: number, patch: Partial<Task>) => void;
  onDeleteTask: (id: number) => void;
  onAddTask: (t: Partial<Task>) => void;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});

  function addToJob(jobId: string) {
    const text = inputs[jobId]?.trim();
    if (!text) return;
    onAddTask({ text, column: "todo", job: jobId, id: Date.now(), dueDate: "", urgent: false, important: false, pinned: false, assignee: "u1", repeat: "none", customInterval: 1, customUnit: "week" });
    setInputs(n => ({ ...n, [jobId]: "" }));
  }

  return (
    <div className="flex h-full overflow-x-auto overflow-y-hidden p-4 gap-4">
      {jobs.filter(j => !j.archived).map(job => {
        const jobTasks = tasks.filter(t => t.job === job.id && t.column !== "done" && (!t.checklistWeek || t.onBoard))
          .sort((a, b) => (isOverdue(a) ? 0 : a.pinned ? 1 : 2) - (isOverdue(b) ? 0 : b.pinned ? 1 : 2));
        return (
          <div key={job.id} className="flex-shrink-0 flex flex-col rounded-xl overflow-hidden"
            style={{ width: 280, height: "100%", border: "2px solid var(--card-border)", background: "#f7f7f8" }}>
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 bg-white" style={{ borderBottom: "1.5px solid var(--card-border)" }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ background: job.color }} />
                <span className="font-bold text-sm">{job.name}</span>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: job.color }}>{jobTasks.length}</span>
            </div>
            {/* Quick add */}
            <div className="px-3 py-2 flex gap-2 flex-shrink-0 bg-white" style={{ borderBottom: "1px solid #f0f0f0" }}>
              <input type="text" placeholder="Add a task..." value={inputs[job.id] ?? ""}
                onChange={e => setInputs(n => ({ ...n, [job.id]: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addToJob(job.id)}
                className="flex-1 text-xs px-2 py-1 rounded outline-none"
                style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)" }} />
              <button type="button" onClick={() => addToJob(job.id)}
                className="px-2 py-1 text-xs font-bold rounded cursor-pointer border-none text-white"
                style={{ background: job.color }}>Add</button>
            </div>
            {/* Tasks */}
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
              {jobTasks.map(task => {
                const over = isOverdue(task);
                const label = repeatLabel(task);
                return (
                  <div key={task.id} className="rounded-xl p-3 task-card-shadow"
                    style={{ background: over ? "var(--overdue-bg)" : "white", border: over ? "none" : "1.5px solid var(--card-border)" }}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold leading-snug flex-1" style={{ color: over ? "white" : "var(--body-text)" }}>{task.text}</span>
                      <div className="flex gap-1 flex-shrink-0">
                        <button type="button" onClick={() => onUpdateTask(task.id, { pinned: !task.pinned })}
                          className="w-6 h-6 rounded flex items-center justify-center border-none cursor-pointer text-xs"
                          style={{ background: task.pinned ? "#F5A623" : "rgba(0,0,0,0.1)" }}>📌</button>
                        <button type="button" onClick={() => onDeleteTask(task.id)}
                          className="w-6 h-6 rounded flex items-center justify-center border-none cursor-pointer font-bold text-base"
                          style={{ background: over ? "rgba(255,255,255,0.15)" : "#eee", color: over ? "white" : "var(--muted-text)", lineHeight: 1 }}>×</button>
                      </div>
                    </div>
                    <div className="text-xs mb-1" style={{ color: over ? "rgba(255,255,255,0.7)" : "var(--muted-text)" }}>
                      {task.column === "todo" ? "To Do" : "In Progress"}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {task.dueDate && <span className="text-xs" style={{ color: over ? "rgba(255,255,255,0.7)" : "var(--muted-text)" }}>{task.dueDate}</span>}
                      {over && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>OVERDUE</span>}
                    </div>
                    {label && <div className="mt-1 text-xs font-bold" style={{ color: over ? "rgba(255,255,255,0.6)" : "var(--muted-text)" }}>↻ {label}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tools ────────────────────────────────────────────────────────────────────
function TickCounter() {
  const [columns, setColumns] = useState([
    { id: 1, label: "Jambs",       count: 0, renaming: false },
    { id: 2, label: "Corners",     count: 0, renaming: false },
    { id: 3, label: "Punch Items", count: 0, renaming: false },
  ]);
  const [newLabel, setNewLabel] = useState("");
  const [flash, setFlash] = useState<number | null>(null); // column id that just got a tick
  const nextId = useRef(4);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  // Single global keyboard handler — increments column at position (key - 1)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when any text input/textarea/select has focus
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const n = parseInt(e.key, 10);
      if (isNaN(n) || n < 1) return;
      const col = columnsRef.current[n - 1];
      if (!col) return;
      increment(col.id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // intentionally empty — columnsRef stays current without re-registering

  function increment(id: number) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, count: c.count + 1 } : c));
    setFlash(id);
    setTimeout(() => setFlash(null), 250);
  }

  function decrement(id: number) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, count: Math.max(0, c.count - 1) } : c));
  }

  function resetOne(id: number) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, count: 0 } : c));
  }

  function removeColumn(id: number) {
    setColumns(prev => prev.filter(c => c.id !== id));
  }

  function addColumn() {
    if (!newLabel.trim()) return;
    setColumns(prev => [...prev, { id: nextId.current++, label: newLabel.trim(), count: 0, renaming: false }]);
    setNewLabel("");
  }

  function startRename(id: number) {
    setColumns(prev => prev.map(c => ({ ...c, renaming: c.id === id })));
  }

  function commitRename(id: number, val: string) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, label: val.trim() || c.label, renaming: false } : c));
  }

  const total = columns.reduce((a, c) => a + c.count, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Keyboard hint */}
      <div className="rounded-xl px-4 py-3 text-xs flex items-center gap-2" style={{ background: "#f0f4ff", border: "1.5px solid #c7d7fb", color: "#3b5bdb" }}>
        <span style={{ fontSize: 16 }}>⌨️</span>
        <span>Press <strong>1 – {Math.min(columns.length, 9)}</strong> to add a tick to the matching column. Clicking <strong>−</strong> or resetting is mouse-only to avoid accidents.</span>
      </div>

      {/* Columns */}
      {columns.map((col, idx) => {
        const shortcut = idx < 9 ? idx + 1 : null;
        const isFlashing = flash === col.id;
        return (
          <div key={col.id} className="rounded-xl bg-white overflow-hidden transition-all"
            style={{ border: isFlashing ? "2px solid var(--brand-red)" : "1.5px solid var(--card-border)", boxShadow: isFlashing ? "0 0 0 3px rgba(236,32,39,0.15)" : "none" }}>
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #f0f0f0" }}>
              {/* Shortcut badge */}
              {shortcut !== null && (
                <span className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                  style={{ background: "#f0f0f0", color: "var(--muted-text)", border: "1px solid #ddd" }}>{shortcut}</span>
              )}
              {/* Label or rename input */}
              {col.renaming ? (
                <input autoFocus type="text" defaultValue={col.label}
                  className="flex-1 text-sm font-semibold px-2 py-0.5 rounded"
                  style={{ border: "1.5px solid var(--brand-red)", fontFamily: "var(--font-main)", outline: "none" }}
                  onBlur={e => commitRename(col.id, e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") commitRename(col.id, (e.target as HTMLInputElement).value); if (e.key === "Escape") setColumns(prev => prev.map(c => ({ ...c, renaming: false }))); }} />
              ) : (
                <span className="flex-1 text-sm font-semibold cursor-pointer hover:opacity-70 transition-opacity"
                  style={{ color: "var(--body-text)" }}
                  onDoubleClick={() => startRename(col.id)}
                  title="Double-click to rename">{col.label}</span>
              )}
              {/* Rename + remove */}
              <button type="button" onClick={() => startRename(col.id)}
                className="text-xs px-2 py-0.5 rounded cursor-pointer border-none hover:bg-gray-100"
                style={{ color: "var(--muted-text)", background: "transparent" }}>✏️</button>
              <button type="button" onClick={() => removeColumn(col.id)}
                className="text-xs px-2 py-0.5 rounded cursor-pointer border-none hover:bg-red-50"
                style={{ color: "var(--muted-text)", background: "transparent" }}>🗑</button>
            </div>
            {/* Counter row */}
            <div className="flex items-center justify-between px-4 py-3">
              {/* Decrement — click only, disabled at zero */}
              <Tip label="Subtract one tick (click only — no keyboard shortcut)">
                <button type="button" onClick={() => decrement(col.id)} disabled={col.count === 0}
                  className="w-10 h-10 rounded-xl text-xl font-bold flex items-center justify-center cursor-pointer transition-all"
                  style={{ border: "1.5px solid var(--card-border)", background: col.count === 0 ? "#fafafa" : "white", color: col.count === 0 ? "#ccc" : "var(--body-text)", cursor: col.count === 0 ? "not-allowed" : "pointer" }}>−</button>
              </Tip>

              {/* Count display */}
              <div className="flex flex-col items-center">
                <span className="font-bold leading-none" style={{ fontSize: 48, color: isFlashing ? "var(--brand-red)" : "var(--body-text)", transition: "color 0.15s" }}>{col.count}</span>
                <button type="button" onClick={() => resetOne(col.id)}
                  className="text-xs cursor-pointer border-none bg-transparent mt-1 hover:underline"
                  style={{ color: "var(--muted-text)" }}>reset</button>
              </div>

              {/* Increment — click or keyboard shortcut */}
              <Tip label={shortcut ? `Add one tick  (or press key ${shortcut})` : "Add one tick"}>
                <button type="button" onClick={() => increment(col.id)}
                  className="w-10 h-10 rounded-xl text-xl font-bold flex items-center justify-center cursor-pointer border-none text-white transition-all"
                  style={{ background: "linear-gradient(180deg,#f4474d 0%,#EC2027 50%,#cf1a20 100%)" }}>+</button>
              </Tip>
            </div>
          </div>
        );
      })}

      {/* Add column row */}
      <div className="flex gap-2">
        <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="New category name..."
          onKeyDown={e => e.key === "Enter" && addColumn()}
          className="flex-1 px-3 py-1.5 rounded-lg text-sm"
          style={{ border: "1.5px solid var(--card-border)", fontFamily: "var(--font-main)", outline: "none" }} />
        <RedBtn onClick={addColumn}>+ Add</RedBtn>
      </div>

      {/* Total + reset all */}
      <div className="flex items-center justify-between pt-1" style={{ borderTop: "1.5px solid var(--card-border)" }}>
        <span className="text-sm font-semibold" style={{ color: "var(--muted-text)" }}>Total: <strong style={{ color: "var(--body-text)" }}>{total}</strong></span>
        <button type="button" onClick={() => setColumns(p => p.map(c => ({ ...c, count: 0 })))}
          className="text-xs cursor-pointer border-none bg-transparent hover:underline"
          style={{ color: "var(--brand-red)" }}>Reset all</button>
      </div>
    </div>
  );
}

const DEFAULT_GLASS_ROWS = [
  { tag: "GT-001", width: '36"', height: '84"', qty: "1", type: "Tempered",  finish: "Clear" },
  { tag: "GT-002", width: '48"', height: '84"', qty: "2", type: "Tempered",  finish: "Frosted" },
  { tag: "GT-003", width: '24"', height: '60"', qty: "3", type: "Laminated", finish: "Clear" },
];

function GlassTagExtractor() {
  const [rows, setRows] = useState(DEFAULT_GLASS_ROWS.map(r => ({ ...r })));
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Under-construction notice */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ background: "#fffbeb", border: "1.5px solid #f59e0b" }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>🚧</span>
        <div>
          <p className="text-sm font-bold" style={{ color: "#92400e" }}>Under Construction</p>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#b45309" }}>
            The AI extraction feature requires a backend vision API that has not been integrated yet. The upload button and table below are placeholders — you can edit rows manually and export to CSV in the meantime. AI-powered extraction will be enabled once the backend is connected.
          </p>
        </div>
      </div>

      <div className="text-sm" style={{ color: "var(--muted-text)" }}>
        Upload shop drawing screenshots and get a clean, editable table of glass tag data — ready to paste into Excel.
      </div>

      <label className="rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-gray-50 transition-all"
        style={{ border: "2px dashed var(--card-border)", minHeight: 80, opacity: 0.5, cursor: "not-allowed" }}>
        <span className="text-2xl">📄</span>
        <span className="text-sm font-semibold" style={{ color: "var(--muted-text)" }}>AI extraction not yet available</span>
        <input type="file" accept="image/*" className="hidden" disabled />
      </label>

      <div className="overflow-x-auto rounded-xl" style={{ border: "1.5px solid var(--card-border)" }}>
        <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f7f7f8", borderBottom: "1.5px solid var(--card-border)" }}>
              {["Tag","Width","Height","Qty","Type","Finish"].map(h => (
                <th key={h} className="px-3 py-2 text-left font-bold uppercase tracking-wider" style={{ color: "var(--muted-text)" }}>{h}</th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                {(["tag","width","height","qty","type","finish"] as const).map(k => (
                  <td key={k} className="px-3 py-2">
                    <input value={row[k]} onChange={e => setRows(p => p.map((r,j) => j===i ? {...r,[k]:e.target.value} : r))}
                      className="bg-transparent w-full text-xs" style={{ fontFamily: "var(--font-main)", outline: "none", border: "none" }} />
                  </td>
                ))}
                <td className="px-2 py-2">
                  <button type="button" onClick={() => setRows(p => p.filter((_,j) => j !== i))}
                    className="text-xs cursor-pointer border-none bg-transparent hover:text-red-500"
                    style={{ color: "var(--muted-text)" }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 flex-wrap">
        <RedBtn onClick={() => {
          const csv = ["Tag,Width,Height,Qty,Type,Finish", ...rows.map(r => `${r.tag},${r.width},${r.height},${r.qty},${r.type},${r.finish}`)].join("\n");
          const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
          a.download = "glass-tags.csv"; a.click();
        }}>Export to CSV</RedBtn>
        <OutBtn onClick={() => setRows(p => [...p, { tag: `GT-00${p.length+1}`, width: '""', height: '""', qty: "1", type: "Tempered", finish: "Clear" }])}>+ Add Row</OutBtn>
        <OutBtn onClick={() => setConfirmReset(true)}>↺ Reset Table</OutBtn>
      </div>

      {confirmReset && (
        <ConfirmDialog
          message="Clear the table and restore the default rows?"
          onConfirm={() => { setRows(DEFAULT_GLASS_ROWS.map(r => ({ ...r }))); setConfirmReset(false); }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}

function Tools() {
  const [activeTool, setActiveTool] = useState<"none"|"tick"|"glass">("none");

  if (activeTool !== "none") {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-5 gap-4">
        <button type="button" onClick={() => setActiveTool("none")} className="self-start text-sm font-semibold cursor-pointer bg-transparent border-none hover:underline" style={{ color: "var(--brand-red)" }}>← Back to Tools</button>
        <h2 className="text-xl font-bold">{activeTool === "tick" ? "Tick Counter" : "Glass Tag Extractor"}</h2>
        {activeTool === "tick" ? <TickCounter /> : <GlassTagExtractor />}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 gap-4">
      <div><SectionLabel>Tools</SectionLabel><p className="text-sm mt-1" style={{ color: "var(--muted-text)" }}>Small utilities for job-site work. Pick one to open it.</p></div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { id:"tick" as const, title:"Tick Counter", desc:"Quick tally counters for on-site counts — jambs, corners, punch items, anything you need to click off as you go." },
          { id:"glass" as const, title:"Glass Tag Extractor", desc:"Upload shop drawing screenshots and get a clean, editable table of glass tag data — ready to paste into Excel." },
        ].map(tool => (
          <div key={tool.id} className="rounded-xl p-5 bg-white section-card-shadow cursor-pointer hover:border-gray-400 transition-all" style={{ border: "1.5px solid var(--card-border)" }}>
            <h3 className="font-bold text-base mb-2">{tool.title}</h3>
            <p className="text-sm mb-4" style={{ color: "var(--muted-text)" }}>{tool.desc}</p>
            <button type="button" onClick={() => setActiveTool(tool.id)} className="text-sm font-bold cursor-pointer bg-transparent border-none hover:underline" style={{ color: "var(--brand-red)" }}>Open →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [activeTab, setActiveTab] = useState<Tab>("checklist");
  const [showNewJob, setShowNewJob] = useState(false);
  const [showManageJobs, setShowManageJobs] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [flashTaskId, setFlashTaskId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  // Persist on every state change
  useEffect(() => { saveState(state); }, [state]);

  // Flash clears after 2s
  useEffect(() => { if (flashTaskId) { const t = setTimeout(() => setFlashTaskId(null), 2000); return () => clearTimeout(t); } }, [flashTaskId]);

  const patch = useCallback((p: Partial<AppState>) => setState(s => ({ ...s, ...p })), []);

  const activeJob = state.jobs.find(j => j.id === state.activeJobId) ?? state.jobs[0];

  function addJob(name: string, color: string, turnoverDate: string) {
    const id = `j${Date.now()}`;
    patch({ jobs: [...state.jobs, { id, name, color, turnoverDate, archived: false }], activeJobId: id });
  }

  function updateJob(id: string, p: Partial<JobSite>) {
    patch({ jobs: state.jobs.map(j => j.id === id ? { ...j, ...p } : j) });
  }

  function deleteJob(id: string) {
    const remaining = state.jobs.filter(j => j.id !== id);
    patch({
      jobs: remaining,
      tasks: state.tasks.filter(t => t.job !== id),
      activeJobId: remaining.find(j => !j.archived)?.id ?? remaining[0]?.id ?? state.activeJobId,
    });
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `1cg-backup-${TODAY}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function triggerImport() {
    importRef.current?.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Partial<AppState>;
        const merged: AppState = {
          jobs:           Array.isArray(parsed.jobs)    ? parsed.jobs    : state.jobs,
          tasks:          Array.isArray(parsed.tasks)   ? parsed.tasks   : state.tasks,
          activeJobId:    parsed.activeJobId            ?? state.activeJobId,
          activeUser:     parsed.activeUser             ?? state.activeUser,
          navOrder:       Array.isArray(parsed.navOrder) ? parsed.navOrder : state.navOrder,
          checklistDone:  parsed.checklistDone          ?? {},
          reportDrafts:   parsed.reportDrafts           ?? {},
          reportArchives: parsed.reportArchives         ?? {},
        };
        setState(merged);
        setImportStatus("Import successful!");
      } catch {
        setImportStatus("Import failed — file may be corrupt.");
      }
      setTimeout(() => setImportStatus(null), 4000);
      e.target.value = "";
    };
    reader.readAsText(file);
  }

  function updateTask(id: number, p: Partial<Task>) {
    patch({ tasks: state.tasks.map(t => {
      if (t.id !== id) return t;
      const updated = { ...t, ...p };
      // Rolling recurring: if marking done and has repeat rule, advance and snap to todo
      if (p.column === "done" && updated.repeat !== "none" && updated.dueDate) {
        return { ...updated, column: "todo", dueDate: nextDueDate(updated.dueDate, updated.repeat, updated.customInterval, updated.customUnit) };
      }
      return updated;
    })});
  }

  function deleteTask(id: number) {
    patch({ tasks: state.tasks.filter(t => t.id !== id) });
  }

  function addTask(t: Partial<Task>) {
    const full: Task = {
      id: t.id ?? Date.now(), text: t.text ?? "", column: t.column ?? "todo",
      dueDate: t.dueDate ?? "", urgent: t.urgent ?? false, important: t.important ?? false,
      pinned: t.pinned ?? false, assignee: t.assignee ?? "u1", job: t.job ?? state.activeJobId,
      repeat: t.repeat ?? "none", customInterval: t.customInterval ?? 1, customUnit: t.customUnit ?? "week",
    };
    patch({ tasks: [...state.tasks, full] });
  }

  function setChecklistDone(k: string, v: boolean) {
    patch({ checklistDone: { ...state.checklistDone, [k]: v } });
  }

  function setReportDraft(key: string, val: string) {
    const cur = state.reportDrafts[state.activeJobId] ?? {};
    patch({ reportDrafts: { ...state.reportDrafts, [state.activeJobId]: { ...cur, [key]: val } } });
  }

  function archiveReport() {
    const draft = state.reportDrafts[state.activeJobId] ?? {};
    const cur = state.reportArchives[state.activeJobId] ?? [];
    patch({ reportArchives: { ...state.reportArchives, [state.activeJobId]: [{ id: Date.now(), date: TODAY, data: { ...draft } }, ...cur] } });
  }

  function onSearchSelect(taskId: number) {
    setFlashTaskId(taskId);
    setActiveTab("taskboard");
    // Force job filter to alljobs so it's visible
  }

  const draft = state.reportDrafts[state.activeJobId] ?? {};
  const archives = state.reportArchives[state.activeJobId] ?? [];

  function renderContent() {
    switch (activeTab) {
      case "checklist": return <MilestoneChecklist job={activeJob} tasks={state.tasks} onUpdateTask={updateTask} onAddTask={addTask} updateJob={updateJob} />;
      case "report":    return <WeeklyStatusReport job={activeJob} tasks={state.tasks} draft={draft} setDraft={setReportDraft} archives={archives} onArchive={archiveReport} />;
      case "taskboard": return <TaskBoard tasks={state.tasks} jobs={state.jobs} activeJobId={state.activeJobId} onUpdateTask={updateTask} onDeleteTask={deleteTask} onAddTask={addTask} flashTaskId={flashTaskId} />;
      case "calendar":  return <CalendarView tasks={state.tasks} jobs={state.jobs} activeJobId={state.activeJobId} onTaskClick={onSearchSelect} />;
      case "dashboard": return <Dashboard tasks={state.tasks} jobs={state.jobs} activeJobId={state.activeJobId} />;
      case "byjob":     return <ByJob tasks={state.tasks} jobs={state.jobs} onUpdateTask={updateTask} onDeleteTask={deleteTask} onAddTask={addTask} />;
      case "tools":     return <Tools />;
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: "var(--font-main)" }}>
      <TopBar search={search} setSearch={setSearch} onSearchSelect={onSearchSelect} tasks={state.tasks} jobs={state.jobs} />
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar
          activeTab={activeTab} setActiveTab={setActiveTab}
          jobs={state.jobs} activeJobId={state.activeJobId} setActiveJobId={id => patch({ activeJobId: id })}
          activeUser={state.activeUser} setActiveUser={u => patch({ activeUser: u })}
          navOrder={state.navOrder} onNewJob={() => setShowNewJob(true)}
          onExport={exportBackup} onImport={triggerImport} onManageJobs={() => setShowManageJobs(true)}
        />
        <main className="flex-1 overflow-hidden min-h-0 min-w-0">
          {renderContent()}
        </main>
      </div>

      {showNewJob && (
        <NewJobModal
          onAdd={addJob}
          onClose={() => setShowNewJob(false)}
          usedColors={state.jobs.map(j => j.color)}
        />
      )}

      {showManageJobs && (
        <ManageJobsModal
          jobs={state.jobs}
          onClose={() => setShowManageJobs(false)}
          onArchive={(id, archived) => updateJob(id, { archived })}
          onDelete={deleteJob}
        />
      )}

      {/* Hidden file input for import */}
      <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

      {/* Import status toast */}
      {importStatus && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: importStatus.includes("fail") ? "var(--brand-red)" : "#2E7D32" }}>
          {importStatus}
        </div>
      )}
    </div>
  );
}
