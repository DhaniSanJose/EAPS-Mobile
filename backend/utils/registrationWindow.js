/**
 * registrationWindow.js
 *
 * Shared helper for computing whether a branch's registration window
 * is open RIGHT NOW, based on Manila wall-clock time.
 *
 * Why this exists as its own module:
 * Previously this logic was duplicated inline inside the
 * /registration-status/:branch_id route. Now that we also need to run
 * the exact same check when syncing the DB (in /branches GET), it has
 * to live in one place so both call sites can never drift out of sync
 * with each other.
 */

/**
 * Returns the current Manila date/time as a plain Date object whose
 * getHours()/getMinutes()/getFullYear()/etc. all reflect Manila wall-clock
 * values, regardless of what timezone the server itself is running in.
 */
const getNowInManila = () => {
  const nowManilaStr = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    hour12: false,
  });
  return new Date(nowManilaStr);
};

/**
 * Computes whether a single branch should be considered "open" right now,
 * given its stored registration_open flag + start_date/end_date strings
 * (format: "YYYY-MM-DDTHH:mm", e.g. "2026-04-07T06:00").
 *
 * Branches WITHOUT a schedule (no start_date/end_date): pure manual
 * control via the registration_open toggle.
 *
 * Branches WITH a schedule: fully automatic. Saving start_date/end_date
 * is enough to open/close it on time -- no manual toggle needed. The
 * toggle's stored value is treated as a cache of this computed result,
 * not as a gate that blocks it.
 *
 * @param {object} branch - a branch object with registration_open, start_date, end_date
 * @param {Date} [now] - optional override for "current time" (mainly for testing); defaults to live Manila time
 * @returns {boolean} whether the branch's window is currently open
 */
const computeIsOpen = (branch, now = getNowInManila()) => {
  const hasSchedule = !!(branch.start_date && branch.end_date);

  // Branches WITHOUT a schedule: pure manual control via the toggle.
  if (!hasSchedule) {
    return Number(branch.registration_open) === 1;
  }

  // Branches WITH a schedule: the schedule is authoritative.
  const [startDatePart, startTimePart] = branch.start_date.split("T");
  const [endDatePart, endTimePart] = branch.end_date.split("T");

  // Guard against malformed/legacy data that has a date but no "T" time part
  if (!startTimePart || !endTimePart) {
    return Number(branch.registration_open) === 1;
  }

  const [startHour, startMinute] = startTimePart.split(":").map(Number);
  const [endHour, endMinute] = endTimePart.split(":").map(Number);

  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDateOnly = new Date(startDatePart);
  const endDateOnly = new Date(endDatePart);

  const withinDateRange = todayDateOnly >= startDateOnly && todayDateOnly <= endDateOnly;

  let isOpen;

  if (!withinDateRange) {
    isOpen = false;
  } else {
    // Compare at SECOND-level granularity, not minute-level.
    // Using only hours+minutes would round 18:00:01 down to "18:00",
    // making the window appear open for up to 59 extra seconds past
    // the intended cutoff. Seconds matter here because the requirement
    // is "closes immediately the instant the clock hits end time".
    const nowTotal = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const startTotal = startHour * 3600 + startMinute * 60;
    const endTotal = endHour * 3600 + endMinute * 60;

    if (startTotal < endTotal) {
      // Normal same-day window, e.g. 6:00 -> 18:00
      isOpen = nowTotal >= startTotal && nowTotal < endTotal;
    } else {
      // Cross-midnight window, e.g. 18:00 -> 6:00
      isOpen = nowTotal >= startTotal || nowTotal < endTotal;
    }
  }

  // Hard stop: once today's date is past the end date entirely, force closed,
  // no matter what the time-of-day math says.
  if (todayDateOnly > endDateOnly) {
    isOpen = false;
  }

  return isOpen;
};

/**
 * Given the full branches array, returns a NEW array where every branch's
 * registration_open has been recomputed live. Also returns whether anything
 * actually changed, so callers can decide whether a DB write is needed.
 *
 * @param {Array} branches
 * @returns {{ branches: Array, changed: boolean }}
 */
const syncBranchesOpenStatus = (branches) => {
  const now = getNowInManila();
  let changed = false;

  const updated = branches.map((b) => {
    // Only branches that HAVE a schedule are auto-managed.
    // Branches with no start_date/end_date keep whatever the admin set manually.
    if (!b.start_date || !b.end_date) return b;

    const liveIsOpen = computeIsOpen(b, now) ? 1 : 0;
    const storedIsOpen = Number(b.registration_open) === 1 ? 1 : 0;

    if (liveIsOpen !== storedIsOpen) {
      changed = true;
      return { ...b, registration_open: liveIsOpen };
    }
    return b;
  });

  return { branches: updated, changed };
};

module.exports = { getNowInManila, computeIsOpen, syncBranchesOpenStatus };