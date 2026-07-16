import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import {
  Grid,
  Button,
  Typography,
  Box,
  Paper,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from "@mui/material";
import API_BASE_URL from "../apiConfig";
import { getFlatAuditHeaders } from "../utils/auditEvents";
import useAuditMac from "../utils/useAuditMac";

export const DEPARTMENT_PLOTTING_ACCESS_EVENT = "department-plotting-access-changed";

const daySortOrder = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
  SUN: 7,
};

const parseScheduleTimeToMinutes = (value) => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const match = value.toString().trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridian = (match[3] || "").toUpperCase();
  if (meridian === "PM" && hours < 12) hours += 12;
  if (meridian === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const formatProfessorName = (row) =>
  [row.fname, row.mname ? `${row.mname.charAt(0)}.` : "", row.lname]
    .filter(Boolean)
    .join(" ");

const PAGE_ID = 53;

// Shared fixed height for the two side-by-side panels below the department
// buttons. Using a fixed height + internal scroll (instead of Grid's
// alignItems="stretch", which stretched the shorter panel into a large
// empty void) keeps both panels visually consistent regardless of how many
// rows either one has.
const PANEL_HEIGHT = 600;

const ScheduleFilterer = () => {
  useAuditMac();
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [employeeID, setEmployeeID] = useState("");
  const [canEditAccess, setCanEditAccess] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
  }, [settings]);

  const [departmentList, setDepartmentList] = useState([]);
  const [filterDepId, setFilterDepId] = useState(null);
  const [updatingAllowedId, setUpdatingAllowedId] = useState(null);
  const [tableDepartmentId, setTableDepartmentId] = useState("");
  const [plottedSchedules, setPlottedSchedules] = useState([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [toggleError, setToggleError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const permissionHeaders = {
    ...getFlatAuditHeaders(),
    "x-employee-id": employeeID,
    "x-page-id": String(PAGE_ID),
    "x-audit-actor-id":
      employeeID || localStorage.getItem("person_id") || "unknown",
    "x-audit-actor-role": localStorage.getItem("role") || "registrar",
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/get_department`);
      const rows = Array.isArray(res.data) ? res.data : [];
      setDepartmentList(rows);

      if (rows.length > 0) {
        setTableDepartmentId((prev) => prev || String(rows[0].dprtmnt_id));
      }
    } catch (err) {
      console.error("Error fetching departments:", err);
    }
  };

  const fetchPagePermissions = async (resolvedEmployeeId) => {
    if (!resolvedEmployeeId) {
      setCanEditAccess(false);
      setPermissionsLoading(false);
      return;
    }

    setPermissionsLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/page_access/${resolvedEmployeeId}/${PAGE_ID}`,
      );
      const hasPageAccess = Number(res.data?.page_privilege) === 1;
      setCanEditAccess(hasPageAccess && Number(res.data?.can_edit) === 1);
    } catch (err) {
      console.error("Error fetching page permissions:", err);
      setCanEditAccess(false);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const fetchPlottedSchedules = async (departmentId) => {
    if (!departmentId) {
      setPlottedSchedules([]);
      return;
    }

    setSchedulesLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/get_college_professor_schedule/${departmentId}`,
      );
      const rows = Array.isArray(res.data) ? res.data : [];
      const sortedRows = rows.slice().sort((a, b) => {
        const dayA = daySortOrder[(a.day || "").toUpperCase()] || 99;
        const dayB = daySortOrder[(b.day || "").toUpperCase()] || 99;
        if (dayA !== dayB) return dayA - dayB;
        return (
          parseScheduleTimeToMinutes(a.school_time_start) -
          parseScheduleTimeToMinutes(b.school_time_start)
        );
      });
      setPlottedSchedules(sortedRows);
    } catch (err) {
      if (err.response?.status !== 404) {
        console.error("Error fetching plotted schedules:", err);
      }
      setPlottedSchedules([]);
    } finally {
      setSchedulesLoading(false);
    }
  };

  useEffect(() => {
    if (location.pathname !== "/select_college") return;

    const storedEmployeeId = localStorage.getItem("employee_id") || "";
    setEmployeeID(storedEmployeeId);
    fetchDepartments();
    fetchPagePermissions(storedEmployeeId);
  }, [location.pathname]);

  useEffect(() => {
    fetchPlottedSchedules(tableDepartmentId);
  }, [tableDepartmentId]);

  const handleFilterID = (id) => {
    setFilterDepId(id);
    setTableDepartmentId(String(id));
    navigate(`/schedule_checker/${id}`);
  };

  const handleAllowedToggle = (departmentId) => async (event) => {
    if (!canEditAccess || !employeeID) {
      setToggleError(
        "You need Edit permission on Schedule Plotting Form to change department access.",
      );
      return;
    }

    const key = String(departmentId);
    const nextAllowed = event.target.checked;
    const previousRows = departmentList;

    setToggleError("");
    setDepartmentList((prev) =>
      prev.map((department) =>
        String(department.dprtmnt_id) === key
          ? { ...department, is_allowed: nextAllowed ? 1 : 0 }
          : department,
      ),
    );
    setUpdatingAllowedId(departmentId);

    try {
      await axios.put(
        `${API_BASE_URL}/api/department/${departmentId}/is-allowed`,
        { is_allowed: nextAllowed ? 1 : 0 },
        { headers: permissionHeaders },
      );

      window.dispatchEvent(
        new CustomEvent(DEPARTMENT_PLOTTING_ACCESS_EVENT, {
          detail: {
            dprtmnt_id: departmentId,
            is_allowed: nextAllowed ? 1 : 0,
          },
        }),
      );
    } catch (err) {
      console.error("Error updating department plotting access:", err);
      setDepartmentList(previousRows);
      setToggleError(
        err.response?.data?.message ||
        "Failed to update department plotting access. Make sure you have edit permission on this page.",
      );
    } finally {
      setUpdatingAllowedId(null);
    }
  };

  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // 🔒 Block DevTools shortcuts + Ctrl+P silently
  document.addEventListener("keydown", (e) => {
    const isBlockedKey =
      e.key === "F12" ||
      e.key === "F11" ||
      (e.ctrlKey &&
        e.shiftKey &&
        (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) ||
      (e.ctrlKey && e.key.toLowerCase() === "u") ||
      (e.ctrlKey && e.key.toLowerCase() === "p");

    if (isBlockedKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  const selectedTableDepartment = departmentList.find(
    (department) => String(department.dprtmnt_id) === String(tableDepartmentId),
  );

  return (
    <Box
      sx={{
        height: "calc(100vh - 150px)",
        overflowY: "auto",
        paddingRight: 1,
        backgroundColor: "transparent",
        mt: 1,
        padding: 2,
      }}
    >
      <Typography
        variant="h3"
        fontWeight="bold"
        sx={{ color: titleColor, fontSize: "42px" }}
        textAlign="center"
        gutterBottom
        mb={3}
      >
        Select a Department
      </Typography>
      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br />
      <Grid
        container
        spacing={2}
        justifyContent="center"
        alignItems="stretch"
        sx={{
          backgroundColor: "white",
          columnGap: 2,
          rowGap: 2,
          px: 2,
          py: 2,
        }}
      >
        {departmentList.map((department) => (
          <Grid
            key={department.dprtmnt_id}
            size={{ xs: 12, sm: "auto" }}
            sx={{ display: "flex", justifyContent: "center" }}
          >
            <Button
              variant="contained"
              value={department.dprtmnt_id}
              onClick={() => handleFilterID(department.dprtmnt_id)}
              sx={{
                border: `2px solid ${borderColor}`,
                minWidth: { xs: "100%", sm: 180 },
                maxWidth: { xs: "100%", sm: 240 },
                minHeight: 48,
                px: 2,
                py: 1,
                backgroundColor:
                  filterDepId === department.dprtmnt_id
                    ? settings?.header_color || "#1976d2"
                    : "white",
                color: filterDepId === department.dprtmnt_id ? "white" : "maroon",
                fontSize: "0.8rem",
                lineHeight: 1.2,
                textAlign: "center",
                whiteSpace: "normal",
                wordBreak: "break-word",
                "&:hover": {
                  backgroundColor: mainButtonColor,
                  color: "white",
                },
              }}
            >
              {department.dprtmnt_code}
            </Button>
          </Grid>
        ))}
      </Grid>

      <Grid
        container
        spacing={4}
        justifyContent="center"
        alignItems="stretch"
        sx={{ mt: 2, gap: 2 }}
      >
        {/* ---------------- Department Access panel ---------------- */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper
            sx={{
              p: 2,
              border: `1px solid ${borderColor}`,
              height: PANEL_HEIGHT,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h6" fontWeight="bold" textAlign="center" sx={{ mb: 2, color: titleColor }}>
              Department Access
            </Typography>
            {!permissionsLoading && !canEditAccess && (
              <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
                View only: your account does not have Edit permission on this page, so
                department access switches are disabled.
              </Typography>
            )}
            {!permissionsLoading && canEditAccess && !employeeID && (
              <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                Missing employee ID in your session. Log out and log in again, then retry.
              </Typography>
            )}
            {toggleError && (
              <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                {toggleError}
              </Typography>
            )}
            <TableContainer sx={{ flex: 1, overflowY: "auto" }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        color: "white",
                        fontWeight: "bold",
                        backgroundColor: settings?.header_color || "#1976d2",
                      }}
                    >
                      Department
                    </TableCell>
                    <TableCell
                      sx={{
                        color: "white",
                        fontWeight: "bold",
                        width: 100,
                        backgroundColor: settings?.header_color || "#1976d2",
                      }}
                      align="center"
                    >
                      Allowed
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {departmentList.map((department) => (
                    <TableRow key={`allowed-${department.dprtmnt_id}`}>
                      <TableCell>
                        <Typography fontWeight="bold">{department.dprtmnt_code}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {department.dprtmnt_name}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={Number(department.is_allowed ?? 1) === 1}
                          onChange={handleAllowedToggle(department.dprtmnt_id)}
                          disabled={
                            permissionsLoading ||
                            !canEditAccess ||
                            !employeeID ||
                            updatingAllowedId === department.dprtmnt_id
                          }
                          color="primary"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {departmentList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} align="center">
                        No departments found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* ---------------- Plotted Schedules panel ---------------- */}
        <Grid size={{ xs: 12, md: 8}}>
          <Paper
            sx={{
              p: 2,
              border: `1px solid ${borderColor}`,
              height: PANEL_HEIGHT,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              flexWrap="wrap"
              gap={2}
              mb={2}
              position="relative"
            >
              <Typography variant="h6" fontWeight="bold" sx={{ color: titleColor }}>
                Plotted Schedules
              </Typography>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="schedule-department-select-label">Department</InputLabel>
                <Select
                  labelId="schedule-department-select-label"
                  label="Department"
                  value={tableDepartmentId}
                  onChange={(event) => setTableDepartmentId(event.target.value)}
                >
                  {departmentList.map((department) => (
                    <MenuItem key={department.dprtmnt_id} value={String(department.dprtmnt_id)}>
                      {department.dprtmnt_code} Schedules
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {selectedTableDepartment && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {selectedTableDepartment.dprtmnt_name} — all plotted schedules for the active school year
                (one row per class; the plot grid shows one room at a time).
              </Typography>
            )}

            {schedulesLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
                <CircularProgress size={28} />
              </Box>
            ) : (
              <TableContainer sx={{ flex: 1, overflowY: "auto" }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {[
                        "#",
                        "Professor",
                        "Course",
                        "Section",
                        "Day",
                        "Time Start",
                        "Time End",
                        "Room",
                      ].map((label) => (
                        <TableCell
                          key={label}
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            whiteSpace: "nowrap",
                            backgroundColor: settings?.header_color || "#1976d2",
                          }}
                          align={label === "#" ? "center" : "left"}
                        >
                          {label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {plottedSchedules.map((row, index) => (
                      <TableRow key={`${row.employee_id}-${row.day}-${row.school_time_start}-${index}`}>
                        <TableCell align="center">{index + 1}</TableCell>
                        <TableCell>{formatProfessorName(row)}</TableCell>
                        <TableCell>{row.course_code || "—"}</TableCell>
                        <TableCell>
                          {row.program_code && row.section_description
                            ? `${row.program_code}-${row.section_description}`
                            : "—"}
                        </TableCell>
                        <TableCell>{row.day || "—"}</TableCell>
                        <TableCell>{row.school_time_start || "—"}</TableCell>
                        <TableCell>{row.school_time_end || "—"}</TableCell>
                        <TableCell>{row.room_description || "—"}</TableCell>
                      </TableRow>
                    ))}
                    {plottedSchedules.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                          No plotted schedules found for this department.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ScheduleFilterer;