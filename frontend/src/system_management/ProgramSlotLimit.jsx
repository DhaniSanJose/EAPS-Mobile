import React, { useState, useEffect, useContext } from "react";
import { SettingsContext } from "../App";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  TextField,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  Alert,
  Switch,
  FormControlLabel,
} from "@mui/material";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import SearchIcon from "@mui/icons-material/Search";
import LoadingOverlay from "../components/LoadingOverlay";
import Unauthorized from "../components/Unauthorized";
import EaristLogo from "../assets/EaristLogo.png";

const generateSlotOptions = (start = 10, end = 500, step = 10) => {
  const options = [];
  for (let i = start; i <= end; i += step) {
    options.push(i);
  }
  return options;
};

const SLOT_OPTIONS = generateSlotOptions(10, 500, 10);
const ADD_SLOT_OPTIONS = [1, 5, 10, 20, 50, 100];

const ProgramSlotLimit = () => {
  const [yearId, setYearId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [programs, setPrograms] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [department, setDepartment] = useState([]);
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("");
  const [schoolYears, setSchoolYears] = useState([]);
  const [semesters, setSchoolSemester] = useState([]);
  const [maxSlots, setMaxSlots] = useState("");

  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");
  const [stepperColor, setStepperColor] = useState("#000000");

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");

  // 🔹 Authentication and access states
  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [employeeID, setEmployeeID] = useState("");
  const auditConfig = {
    headers: {
      "x-audit-actor-id":
        employeeID ||
        localStorage.getItem("employee_id") ||
        localStorage.getItem("email") ||
        "unknown",
      "x-audit-actor-role": userRole || localStorage.getItem("role") || "registrar",
    },
  };
  const [hasAccess, setHasAccess] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [confirmAllProgramsOpen, setConfirmAllProgramsOpen] = useState(false);
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [selectedSlotRow, setSelectedSlotRow] = useState(null);
  const [slotsToAdd, setSlotsToAdd] = useState("");

  // ── Reset slot states ──────────────────────────────────────────────────────
  const [confirmResetSingleOpen, setConfirmResetSingleOpen] = useState(false);
  const [confirmResetDeptOpen, setConfirmResetDeptOpen] = useState(false);
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState(false);
  const [resetTargetRow, setResetTargetRow] = useState(null);
  // ──────────────────────────────────────────────────────────────────────────

  // ── Snackbar ───────────────────────────────────────────────────────────────
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const showSnack = (message, severity = "success") =>
    setSnack({ open: true, message, severity });

  const handleCloseSnack = (_, reason) => {
    if (reason === "clickaway") return;
    setSnack((prev) => ({ ...prev, open: false }));
  };
  // ──────────────────────────────────────────────────────────────────────────

  const setErrorMessage = (message) => {
    console.error(message);
  };

  const branches = Array.isArray(settings?.branches)
    ? settings.branches
    : typeof settings?.branches === "string"
      ? JSON.parse(settings.branches)
      : [];

  const getDefaultBranch = (branchesInput) => {
    try {
      const branches = Array.isArray(branchesInput)
        ? branchesInput
        : typeof branchesInput === "string"
          ? JSON.parse(branchesInput)
          : [];
      return branches[0]?.id || "";
    } catch (error) {
      return "";
    }
  };

  const defaultBranch = getDefaultBranch(settings?.branches);
  const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
  const pageId = 110;

  useEffect(() => {
    if (!settings) return;

    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
    if (settings.stepper_color) setStepperColor(settings.stepper_color);

    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    } else {
      setFetchedLogo(EaristLogo);
    }

    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);
  }, [settings]);

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    const storedEmployeeID = localStorage.getItem("employee_id");

    if (storedUser && storedRole && storedID) {
      setUser(storedUser);
      setUserRole(storedRole);
      setUserID(storedID);
      setEmployeeID(storedEmployeeID);

      if (storedRole === "registrar") {
        checkAccess(storedEmployeeID);
      } else {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  const checkAccess = async (employeeID) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`,
      );
      if (response.data && response.data.page_privilege === 1) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error("Error checking access:", error);
      setHasAccess(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlotSummary();
  }, [yearId, semesterId]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (department.length > 0 && !selectedDepartmentFilter) {
      const firstDeptId = department[0].dprtmnt_id;
      setSelectedDepartmentFilter(firstDeptId);
      fetchPrograms(firstDeptId);
    }
  }, [department, selectedDepartmentFilter]);

  useEffect(() => {
    const nextPrograms = programs.filter(
      (program) =>
        !selectedBranch || program.components === Number(selectedBranch),
    );

    if (nextPrograms.length === 0) {
      if (selectedProgram) setSelectedProgram("");
      return;
    }

    const selectedStillExists = nextPrograms.some(
      (program) => String(program.curriculum_id) === String(selectedProgram),
    );

    if (!selectedProgram || !selectedStillExists) {
      setSelectedProgram(nextPrograms[0].curriculum_id);
    }
  }, [programs, selectedProgram, selectedBranch]);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/get_school_year/`)
      .then((res) => setSchoolYears(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/get_school_semester/`)
      .then((res) => setSchoolSemester(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    fetchActiveSchoolYear();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/get_department`);
      setDepartment(res.data);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const fetchPrograms = async (dprtmnt_id) => {
    if (!dprtmnt_id) return [];
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/applied_program/${dprtmnt_id}`,
      );
      setPrograms(res.data);
      return res.data;
    } catch (err) {
      console.error("❌ Department fetch error:", err);
      setErrorMessage("Failed to load department list");
      return [];
    }
  };

  const fetchSlotSummary = async () => {
    if (!yearId || !semesterId) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/programs/availability`, {
        params: { year_id: yearId, semester_id: semesterId },
      });
      setSlots(res.data);
    } catch (err) {
      console.error("Failed to fetch slot summary:", err);
      setSlots([]);
    }
  };

  const fetchActiveSchoolYear = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/active_school_year`);
      if (res.data.length > 0) {
        const active = res.data[0];
        setYearId(active.year_id);
        setSemesterId(active.semester_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveSlotLimit = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/program-slots`,
        {
          curriculum_id: selectedProgram,
          max_slots: maxSlots,
          year_id: yearId,
          semester_id: semesterId,
        },
        auditConfig,
      );
      await fetchSlotSummary();
      setSelectedProgram("");
      setMaxSlots("");
      showSnack(`Successfully set ${maxSlots} slots for ${selectedProgramCode || "the selected program"}.`);
    } catch (err) {
      console.error("Failed to save slot limit:", err);
      showSnack("Failed to save slot limit. Please try again.", "error");
    }
  };

  const saveSlotLimitAll = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/program-slots/department`,
        {
          dprtmnt_id: selectedDepartmentFilter,
          max_slots: maxSlots,
          year_id: yearId,
          semester_id: semesterId,
        },
        auditConfig,
      );
      await fetchSlotSummary();
      showSnack(`Successfully set ${maxSlots} slots for all programs in ${selectedDepartmentName}.`);
    } catch (err) {
      console.error("Failed to save department slots:", err);
      showSnack("Failed to save department slots. Please try again.", "error");
    }
  };

  const saveSlotLimitAllPrograms = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/program-slots/all`,
        {
          max_slots: maxSlots,
          year_id: yearId,
          semester_id: semesterId,
        },
        auditConfig,
      );
      await fetchSlotSummary();
      showSnack(`Successfully set ${maxSlots} slots for all programs.`);
    } catch (err) {
      console.error("Failed to save all program slots:", err);
      showSnack("Failed to save slots for all programs. Please try again.", "error");
    }
  };

  const saveAddedSlots = async () => {
    const addSlots = Number(slotsToAdd);
    const curriculumId =
      selectedSlotRow?.curriculum_id ?? selectedSlotRow?.program_id;

    if (
      !curriculumId ||
      !yearId ||
      !semesterId ||
      !Number.isInteger(addSlots) ||
      addSlots < 1
    ) {
      return;
    }

    try {
      await axios.post(
        `${API_BASE_URL}/api/program-slots/add`,
        {
          curriculum_id: curriculumId,
          add_slots: addSlots,
          year_id: yearId,
          semester_id: semesterId,
        },
        auditConfig,
      );
      await fetchSlotSummary();
      setAddSlotOpen(false);
      setSelectedSlotRow(null);
      setSlotsToAdd("");
      showSnack(
        `Successfully added ${addSlots} slot${addSlots !== 1 ? "s" : ""} to (${selectedSlotRow?.program_code || "N/A"}) ${selectedSlotRow?.program_description || "the selected program"}.`
      );
    } catch (err) {
      console.error("Failed to add slots:", err);
      showSnack("Failed to add slots. Please try again.", "error");
    }
  };

  const toggleProgramEStatus = async (row, checked) => {
    const curriculumId = row?.curriculum_id ?? row?.program_id;
    const nextStatus = checked ? 1 : 0;

    if (!curriculumId || !yearId || !semesterId) return;

    // Optimistic UI update
    setSlots((prev) =>
      prev.map((item) =>
        String(item.curriculum_id) === String(curriculumId)
          ? { ...item, e_status: nextStatus }
          : item,
      ),
    );

    try {
      await axios.put(
        `${API_BASE_URL}/api/program-slots/e-status`,
        {
          curriculum_id: curriculumId,
          year_id: yearId,
          semester_id: semesterId,
          e_status: nextStatus,
        },
        auditConfig,
      );
      showSnack(
        nextStatus === 1
          ? `(${row.program_code || "N/A"}) hidden from course selection.`
          : `(${row.program_code || "N/A"}) visible in course selection.`,
      );
    } catch (err) {
      console.error("Failed to update e_status:", err);
      // Revert optimistic update
      setSlots((prev) =>
        prev.map((item) =>
          String(item.curriculum_id) === String(curriculumId)
            ? { ...item, e_status: nextStatus === 1 ? 0 : 1 }
            : item,
        ),
      );
      showSnack("Failed to update e_status. Please try again.", "error");
    }
  };

  const resetSlotSingle = async () => {
    const curriculumId =
      resetTargetRow?.curriculum_id ?? resetTargetRow?.program_id;
    if (!curriculumId || !yearId || !semesterId) return;

    try {
      await axios.delete(
        `${API_BASE_URL}/api/program-slots/reset`,
        {
          data: { curriculum_id: curriculumId, year_id: yearId, semester_id: semesterId },
          ...auditConfig,
        },
      );
      await fetchSlotSummary();
      showSnack(
        `Slots reset for (${resetTargetRow?.program_code || "N/A"}) ${resetTargetRow?.program_description || "the program"}.`
      );
    } catch (err) {
      console.error("Failed to reset slot:", err);
      showSnack("Failed to reset slot. Please try again.", "error");
    } finally {
      setResetTargetRow(null);
    }
  };

  const resetSlotDepartment = async () => {
    if (!selectedDepartmentFilter || !yearId || !semesterId) return;

    try {
      await axios.delete(
        `${API_BASE_URL}/api/program-slots/reset/department`,
        {
          data: { dprtmnt_id: selectedDepartmentFilter, year_id: yearId, semester_id: semesterId },
          ...auditConfig,
        },
      );
      await fetchSlotSummary();
      showSnack(`Slots reset for all programs in ${selectedDepartmentName}.`);
    } catch (err) {
      console.error("Failed to reset department slots:", err);
      showSnack("Failed to reset department slots. Please try again.", "error");
    }
  };

  const resetSlotAll = async () => {
    if (!yearId || !semesterId) return;

    try {
      await axios.delete(
        `${API_BASE_URL}/api/program-slots/reset/all`,
        {
          data: { year_id: yearId, semester_id: semesterId },
          ...auditConfig,
        },
      );
      await fetchSlotSummary();
      showSnack("Slots reset for all programs.");
    } catch (err) {
      console.error("Failed to reset all slots:", err);
      showSnack("Failed to reset all slots. Please try again.", "error");
    }
  };

  const handleConfirmSave = () => {
    if (!selectedProgram || !yearId || !semesterId || !maxSlots) return;
    setConfirmOpen(true);
  };

  const handleConfirmSaveAll = () => {
    if (!selectedDepartmentFilter || !yearId || !semesterId || !maxSlots) return;
    setConfirmAllOpen(true);
  };

  const handleConfirmSaveAllPrograms = () => {
    if (!yearId || !semesterId || !maxSlots) return;
    setConfirmAllProgramsOpen(true);
  };

  const handleCollegeChange = (e) => {
    const selectedId = e.target.value;
    setSelectedDepartmentFilter(selectedId);
    setSelectedProgram("");
    setPrograms([]);
    fetchPrograms(selectedId);
  };

  const handleOpenAddSlot = (row) => {
    setSelectedSlotRow(row);
    setSlotsToAdd("");
    setAddSlotOpen(true);
  };

  const handleCloseAddSlot = () => {
    setAddSlotOpen(false);
    setSelectedSlotRow(null);
    setSlotsToAdd("");
  };

  const filteredSlots = slots.filter(
    (row) =>
      (!selectedDepartmentFilter ||
        row.dprtmnt_id === Number(selectedDepartmentFilter)) &&
      (!selectedBranch || row.components === Number(selectedBranch)) &&
      (!searchTerm ||
        `${row.program_code} ${row.program_description} ${row.major || ""}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()))
  );

  const filteredDepartments = department.filter((dep) =>
    slots.some(
      (row) =>
        row.dprtmnt_id === dep.dprtmnt_id &&
        (!selectedBranch || row.components === Number(selectedBranch)),
    ),
  );

  const filteredPrograms = programs.filter(
    (program) =>
      !selectedBranch || program.components === Number(selectedBranch),
  );

  const currentCalendarYear = new Date().getFullYear();
  const earliestVisibleYear = currentCalendarYear - 10;
  const visibleSchoolYears = schoolYears.filter((sy) => {
    const startYear = Number(sy.current_year ?? sy.year_description);
    return (
      Number.isFinite(startYear) &&
      startYear <= currentCalendarYear &&
      startYear >= earliestVisibleYear
    );
  });

  useEffect(() => {
    if (filteredDepartments.length > 0) {
      const exists = filteredDepartments.some(
        (dep) => dep.dprtmnt_id === Number(selectedDepartmentFilter)
      );
      if (!selectedDepartmentFilter || !exists) {
        const firstDeptId = filteredDepartments[0].dprtmnt_id;
        setSelectedDepartmentFilter(firstDeptId);
        fetchPrograms(firstDeptId);
      }
    } else {
      setSelectedDepartmentFilter("");
      setPrograms([]);
    }
  }, [filteredDepartments, selectedDepartmentFilter]);

  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }

  if (!hasAccess) {
    return <Unauthorized />;
  }

  const selectedProgramItem = programs.find(
    (p) => String(p.curriculum_id) === String(selectedProgram),
  );
  const selectedProgramCode = selectedProgramItem
    ? selectedProgramItem.program_code
    : "";

  const selectedDepartmentItem = department.find(
    (d) => d.dprtmnt_id === Number(selectedDepartmentFilter),
  );
  const selectedDepartmentName = selectedDepartmentItem
    ? selectedDepartmentItem.dprtmnt_name
    : "selected department";

  const addSlotsNumber = Number(slotsToAdd);
  const canAddSlots =
    selectedSlotRow &&
    Number.isInteger(addSlotsNumber) &&
    addSlotsNumber > 0;
  const selectedSlotCurrentTotal = Number(selectedSlotRow?.max_slots || 0);
  const selectedSlotRemaining = Number(selectedSlotRow?.remaining || 0);

  const handleSelectBranch = (e) => {
    const branchId = e.target.value;
    setSelectedBranch(branchId);
    setSelectedProgram("");
    setSelectedDepartmentFilter("");
  };
     // 🔒 Disable right-click
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography
          variant="h4"
          sx={{ fontWeight: "bold", color: titleColor, fontSize: "36px" }}
        >
          ADMISSION PROGRAM SLOT
        </Typography>

        <TextField
          size="small"
          placeholder="Search Program"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            width: 450,
            backgroundColor: "#fff",
            borderRadius: 1,
            "& .MuiOutlinedInput-root": { borderRadius: "10px" },
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} />,
          }}
        />
      </Box>

      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br />
      <br />

      <TableContainer
        component={Paper}
        sx={{ width: "100%", border: `1px solid ${borderColor}` }}
      >
        <Table>
          <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
            <TableRow>
              <TableCell sx={{ color: "white", textAlign: "Center" }}>
                Program Slot (Remaining)
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>

      <Paper sx={{ p: 3, mb: 4, border: `1px solid ${borderColor}` }}>
        <Box display="flex" gap={2}>
          <FormControl fullWidth>
            <Select
              value={selectedBranch}
              onChange={handleSelectBranch}
              MenuProps={{ PaperProps: { sx: { marginTop: "8px" } } }}
            >
              <MenuItem value="">All Branches</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.branch}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <Select
              name="campus"
              value={yearId}
              onChange={(e) => setYearId(e.target.value)}
              MenuProps={{ PaperProps: { sx: { maxHeight: 410, marginTop: "8px" } } }}
            >
              {visibleSchoolYears.map((sy) => (
                <MenuItem key={sy.year_id} value={sy.year_id}>
                  {sy.current_year} - {sy.next_year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <Select
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              MenuProps={{ PaperProps: { sx: { maxHeight: 410, marginTop: "8px" } } }}
            >
              {semesters.map((sem) => (
                <MenuItem key={sem.semester_id} value={sem.semester_id}>
                  {sem.semester_description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <Select
              value={selectedDepartmentFilter}
              onChange={handleCollegeChange}
              MenuProps={{ PaperProps: { sx: { marginTop: "8px" } } }}
            >
              {filteredDepartments.map((dep) => (
                <MenuItem key={dep.dprtmnt_id} value={dep.dprtmnt_id}>
                  {dep.dprtmnt_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <Select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">Select Program</MenuItem>
              {filteredPrograms.map((p) => (
                <MenuItem key={p.curriculum_id} value={p.curriculum_id}>
                  ({p.program_code}-{p.year_description}) {p.program_description}{" "}
                  {p.program_major}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <Select
              value={maxSlots}
              onChange={(e) => setMaxSlots(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">Max Slots</MenuItem>
              {SLOT_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <TextField
              label="Max Slots"
              type="number"
              value={maxSlots}
              onChange={(e) => setMaxSlots(Number(e.target.value))}
              inputProps={{ min: 1 }}
            />
          </FormControl>

          {/* Reset Per Department button */}
          <Button
            variant="contained"
            sx={{
              minWidth: 200,
              height: 56,
              backgroundColor: "#9E0000",
              color: "white",
              fontWeight: 700,
              whiteSpace: "nowrap",
              flexShrink: 0,
              "&:hover": { backgroundColor: "#7b0000" },
            }}
            disabled={!selectedDepartmentFilter || !yearId || !semesterId}
            onClick={() => setConfirmResetDeptOpen(true)}
          >
            Reset Per Department
          </Button>

          {/* Reset All button */}
          <Button
            variant="contained"
            sx={{
              minWidth: 140,
              height: 56,
              backgroundColor: "#9E0000",
              color: "white",
              fontWeight: 700,
              whiteSpace: "nowrap",
              flexShrink: 0,
              "&:hover": { backgroundColor: "#7b0000" },
            }}
            disabled={!yearId || !semesterId}
            onClick={() => setConfirmResetAllOpen(true)}
          >
            Reset All
          </Button>
        </Box>

        <Box width="100%" display="flex" gap={2} sx={{ mt: 3 }}>
          <Button
            variant="contained"
            sx={{ minWidth: 250, height: 55 }}
            onClick={handleConfirmSave}
            disabled={!selectedProgram || !yearId || !semesterId}
          >
            Save
          </Button>

          <Button
            variant="contained"
            sx={{ minWidth: 250, height: 55 }}
            onClick={handleConfirmSaveAll}
            disabled={
              !selectedDepartmentFilter ||
              !yearId ||
              !semesterId ||
              !maxSlots ||
              filteredPrograms.length === 0
            }
          >
            Save Slot Per Department
          </Button>

          <Button
            variant="contained"
            onClick={handleConfirmSaveAllPrograms}
            sx={{ minWidth: 250, height: 55 }}
            disabled={!yearId || !semesterId || !maxSlots}
          >
            Save All
          </Button>
        </Box>
      </Paper>

      {/* ── Confirm single program ── */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Slot Setup</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Do you want to set {maxSlots} slot{maxSlots !== 1 ? "s" : ""} for{" "}
            {selectedProgramCode || "the selected program"}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="error" variant="outlined" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              setConfirmOpen(false);
              await saveSlotLimit();
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirm per department ── */}
      <Dialog open={confirmAllOpen} onClose={() => setConfirmAllOpen(false)}>
        <DialogTitle>Confirm Slot Setup</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Do you want to set {maxSlots} slots for all programs in{" "}
            {selectedDepartmentName}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="error" variant="outlined" onClick={() => setConfirmAllOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              setConfirmAllOpen(false);
              await saveSlotLimitAll();
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirm all programs ── */}
      <Dialog open={confirmAllProgramsOpen} onClose={() => setConfirmAllProgramsOpen(false)}>
        <DialogTitle>Confirm Slot Setup</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Do you want to set {maxSlots} slots for all programs?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="error" variant="outlined" onClick={() => setConfirmAllProgramsOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              setConfirmAllProgramsOpen(false);
              await saveSlotLimitAllPrograms();
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Add Slot Dialog ── */}
      <Dialog
        open={addSlotOpen}
        onClose={handleCloseAddSlot}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Program Slot</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1 }}>
            <Box>
              <Typography fontSize={13} color="text.secondary">
                Program
              </Typography>
              <Typography fontWeight={700}>
                ({selectedSlotRow?.program_code || "N/A"}){" "}
                {selectedSlotRow?.program_description || "Selected Program"}
              </Typography>
              {selectedSlotRow?.major && (
                <Typography fontSize={13} color="text.secondary">
                  {selectedSlotRow.major}
                </Typography>
              )}
            </Box>

            <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography fontSize={12} color="text.secondary">
                  Total Slot Added
                </Typography>
                <Typography fontSize={24} fontWeight={700}>
                  {selectedSlotCurrentTotal}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography fontSize={12} color="text.secondary">
                  Remaining Slot
                </Typography>
                <Typography fontSize={24} fontWeight={700}>
                  {selectedSlotRemaining}
                </Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography fontSize={12} color="text.secondary">
                  New Total
                </Typography>
                <Typography fontSize={24} fontWeight={700}>
                  {selectedSlotCurrentTotal + (canAddSlots ? addSlotsNumber : 0)}
                </Typography>
              </Paper>
            </Box>

            <Box display="flex" gap={2}>
              <TextField
                label="Slots to Add"
                type="number"
                fullWidth
                value={slotsToAdd}
                onChange={(e) => setSlotsToAdd(e.target.value)}
                inputProps={{ min: 1, step: 1 }}
                helperText="Only additional slots are allowed. Current slots cannot be reduced here."
              />
              <FormControl sx={{ minWidth: 150 }}>
                <Select
                  value=""
                  displayEmpty
                  onChange={(e) => setSlotsToAdd(e.target.value)}
                >
                  <MenuItem value="">Quick Add</MenuItem>
                  {ADD_SLOT_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      +{option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button color="error" variant="outlined" onClick={handleCloseAddSlot}>
            Cancel
          </Button>
          <Button variant="contained" onClick={saveAddedSlots} disabled={!canAddSlots}>
            Add Slot
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Program Cards ── */}
      <Grid container spacing={3} columns={4}>
        {filteredSlots.map((row) => {
          const remaining = row.remaining;
          const percentage =
            row.max_slots > 0
              ? Math.min((row.total_enrolled / row.max_slots) * 100, 100)
              : 0;

          return (
            <Grid item xs={1} key={row.program_id}>
              <Card
                sx={{
                  height: 380,
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 3,
                  border: `1px solid ${borderColor}`,
                  boxShadow: 3,
                  transition: "0.25s ease",
                  "&:hover": { transform: "translateY(-3px)", boxShadow: 6 },
                }}
              >
                <Box
                  sx={{
                    backgroundColor: remaining <= 0 ? "#d32f2f" : "#388e3c",
                    color: "white",
                    px: 2,
                    py: 1.5,
                    minHeight: 76,
                  }}
                >
                  <Typography fontWeight={600} fontSize={14} lineHeight={1.3}>
                    ({row.program_code}) {row.program_description}
                  </Typography>
                  <Typography fontSize={12} opacity={0.9} noWrap>
                    {row.major}
                  </Typography>
                </Box>

                <CardContent sx={{ flex: 1 }}>
                  <Typography fontSize={28} fontWeight={700}>
                    {remaining}
                  </Typography>
                  <Typography fontSize={20}>
                    <strong>Max Slots:</strong> {row.max_slots}
                  </Typography>
                  <Typography fontSize={13}>
                    <strong>Enrolled:</strong> {row.total_enrolled}
                  </Typography>
                  <Typography fontSize={13} mb={1}>
                    <strong>Remaining:</strong> {remaining}
                  </Typography>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1,
                    }}
                  >
                    <Typography fontSize={13}>
                      <strong>e_status</strong>
                    </Typography>
                    <FormControlLabel
                      sx={{ mr: 0 }}
                      control={
                        <Switch
                          size="small"
                          checked={Number(row.e_status) === 1}
                          onChange={(e) =>
                            toggleProgramEStatus(row, e.target.checked)
                          }
                          color="warning"
                        />
                      }
                      label={
                        <Typography fontSize={12}>
                          {Number(row.e_status) === 1 ? "ON (Hidden)" : "OFF"}
                        </Typography>
                      }
                      labelPlacement="start"
                    />
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={percentage}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#eee",
                      "& .MuiLinearProgress-bar": {
                        backgroundColor:
                          remaining <= 0
                            ? "#d32f2f"
                            : percentage >= 70
                              ? "#f57c00"
                              : "#388e3c",
                      },
                    }}
                  />

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mt: 4,
                    }}
                  >
                    <Chip
                      size="medium"
                      sx={{ width: "100px", height: "40px" }}
                      label={remaining <= 0 ? "FULL" : "OPEN"}
                      color={remaining <= 0 ? "error" : "success"}
                    />
                    <Box display="flex" gap={1}>
                      <Button
                        size="small"
                        variant="contained"
                        sx={{
                          backgroundColor: "green",
                          color: "white",
                          width: "100px",
                          height: "35px",
                        }}
                        onClick={() => handleOpenAddSlot(row)}
                      >
                        Add Slot
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        sx={{
                          backgroundColor: "#9E0000",
                          color: "white",
                          width: "80px",
                          height: "35px",
                          "&:hover": { backgroundColor: "#7b0000" },
                        }}
                        onClick={() => {
                          setResetTargetRow(row);
                          setConfirmResetSingleOpen(true);
                        }}
                      >
                        Reset
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* ── Reset Single Program Confirmation ── */}
      <Dialog open={confirmResetSingleOpen} onClose={() => setConfirmResetSingleOpen(false)}>
        <DialogTitle sx={{ color: "#9E0000", fontWeight: 700 }}>
          ⚠️ Reset Program Slot
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to reset all slots for{" "}
            <strong>
              ({resetTargetRow?.program_code || "N/A"}) {resetTargetRow?.program_description || "this program"}
            </strong>?
          </DialogContentText>
          <DialogContentText sx={{ mt: 1.5, color: "#9E0000", fontWeight: 600 }}>
            ⚠️ This action is irreversible. The slot count will be cleared to zero.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            variant="outlined"
            onClick={() => {
              setConfirmResetSingleOpen(false);
              setResetTargetRow(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              setConfirmResetSingleOpen(false);
              await resetSlotSingle();
            }}
          >
            Yes, Reset
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reset Per Department Confirmation ── */}
      <Dialog open={confirmResetDeptOpen} onClose={() => setConfirmResetDeptOpen(false)}>
        <DialogTitle sx={{ color: "#9E0000", fontWeight: 700 }}>
          ⚠️ Reset Department Slots
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to reset all slots for every program in{" "}
            <strong>{selectedDepartmentName}</strong>?
          </DialogContentText>
          <DialogContentText sx={{ mt: 1.5, color: "#9E0000", fontWeight: 600 }}>
            ⚠️ This action is irreversible. All slot counts in this department will be cleared to zero.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            variant="outlined"
            onClick={() => setConfirmResetDeptOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              setConfirmResetDeptOpen(false);
              await resetSlotDepartment();
            }}
          >
            Yes, Reset
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reset All Programs Confirmation ── */}
      <Dialog open={confirmResetAllOpen} onClose={() => setConfirmResetAllOpen(false)}>
        <DialogTitle sx={{ color: "#9E0000", fontWeight: 700 }}>
          ⚠️ Reset All Program Slots
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to reset slots for <strong>all programs</strong> in
            the current school year and semester?
          </DialogContentText>
          <DialogContentText sx={{ mt: 1.5, color: "#9E0000", fontWeight: 600 }}>
            ⚠️ This action is irreversible. Every program's slot count will be cleared to zero.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            color="error"
            variant="outlined"
            onClick={() => setConfirmResetAllOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              setConfirmResetAllOpen(false);
              await resetSlotAll();
            }}
          >
            Yes, Reset All
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar ── */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={handleCloseSnack}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={handleCloseSnack}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );

}
export default ProgramSlotLimit;