import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  FormControl,
  Select,
  TableCell,
  MenuItem,
  InputLabel,
  TableBody,
  Button,
  Tooltip,
} from '@mui/material';
import { FcPrint } from "react-icons/fc";
import EaristLogo from "../assets/EaristLogo.png";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import API_BASE_URL from "../apiConfig";
import CollegeEnrollmentTabs from "../components/CollegeEnrollmentTabs";
import {
  getDepartmentIdsFromAdminData,
  isRegistrarCurriculumMatch,
  isRegistrarProgramSelectionLocked,
  isRegistrarStudentScopeMatch,
  restrictDepartmentsToScope,
  restrictToRegistrarCurriculum,
  syncRegistrarScopeFromAdminData,
} from "../utils/registrarCurriculumRestriction";
import useRegistrarScopeRevision from "../hooks/useRegistrarScopeRevision";

const ClassRoster = () => {
  const settings = useContext(SettingsContext);

  // ─── Theme colors ────────────────────────────────────────────────────────────
  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff");
  const [stepperColor, setStepperColor] = useState("#000000");

  // ─── School branding ─────────────────────────────────────────────────────────
  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");
  const [user, setUser] = useState("");
  const [adminData, setAdminData] = useState({ dprtmnt_id: "", dprtmnt_ids: [] });

  // ─── Data ─────────────────────────────────────────────────────────────────────
  const [students, setStudents] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [department, setDepartment] = useState([]);
  const [allCurriculums, setAllCurriculums] = useState([]);
  const [curriculumOptions, setCurriculumOptions] = useState([]);

  // ─── Filters ──────────────────────────────────────────────────────────────────
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [selectedSchoolSemester, setSelectedSchoolSemester] = useState("");
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("");
  const [selectedProgramFilter, setSelectedProgramFilter] = useState("");
  const isProgramLocked = isRegistrarProgramSelectionLocked();
  const scopeRevision = useRegistrarScopeRevision();
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("Regular");
  const [selectedRemarkFilter, setSelectedRemarkFilter] = useState("Ongoing");
  const [sortOrder, setSortOrder] = useState("asc");

  // ─── Pagination ───────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ─── Access control ───────────────────────────────────────────────────────────
  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const pageId = 152;

  const remarksMap = { 0: "Ongoing", 1: "Passed", 2: "Failed", 3: "Incomplete", 4: "Drop" };
  const getStudentRegularStatus = (student) =>
    Number(student.official_is_regular ?? student.is_regular ?? student.status);
  const getStudentRegularLabel = (student) =>
    getStudentRegularStatus(student) === 1 ? "Regular" : "Irregular";

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 & 2 — Auth + access check
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedID = localStorage.getItem("person_id");
    const storedEmployee = localStorage.getItem("employee_id");

    if (storedUser && storedRole && storedID) {
      setUser(storedUser);

      if (storedRole === "registrar") {
        checkAccess(storedEmployee);
      } else {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  const checkAccess = async (empID) => {
    try {
      // ── 1. Check page-level privilege for this specific page ──────────────────
      const pageRes = await axios.get(`${API_BASE_URL}/api/page_access/${empID}/${pageId}`);
      const hasPageAccess = pageRes.data?.page_privilege === 1;
      setHasAccess(hasPageAccess);

    } catch (err) {
      console.error("Error checking access:", err);
      setHasAccess(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1 — Fetch admin data
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchAdminData = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/admin_data/${user}`);
        setAdminData(res.data);
        syncRegistrarScopeFromAdminData(res.data);
      } catch (err) {
        console.error("Error fetching admin data:", err);
      }
    };

    fetchAdminData();
  }, [user]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3 — Fetch students for the selected department(s)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const scopedIds = getDepartmentIdsFromAdminData(adminData);
    const departmentIdsToFetch = selectedDepartmentFilter
      ? [selectedDepartmentFilter]
      : scopedIds.length > 1
        ? scopedIds
        : scopedIds.length === 1
          ? [scopedIds[0]]
          : department.length > 0
            ? department.map((dep) => dep.dprtmnt_id)
            : [];

    if (!departmentIdsToFetch.length) {
      if (scopedIds.length > 1 && department.length === 0) return;
      setStudents([]);
      return;
    }

    const fetchStudents = async () => {
      try {
        const responses = await Promise.all(
          departmentIdsToFetch.map(async (departmentId) => {
            const params = new URLSearchParams();
            params.set("department_id", departmentId);
            const url = `${API_BASE_URL}/api/student_number?${params.toString()}`;
            const res = await axios.get(url);
            return Array.isArray(res.data) ? res.data : [];
          }),
        );

        const mergedStudents = [
          ...new Map(
            responses
              .flat()
              .map((student) => [
                `${student.student_number}-${student.year_id}-${student.semester_id}-${student.curriculum_id}`,
                student,
              ]),
          ).values(),
        ];

        setStudents(mergedStudents);
      } catch (err) {
        console.error("Error fetching student data:", err);
      }
    };

    fetchStudents();
  }, [selectedDepartmentFilter, scopeRevision, adminData, department]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 5 — Fetch supporting data (departments, programs, years, semesters)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/get_school_year/`)
      .then(res => setSchoolYears(res.data))
      .catch(console.error);

    axios.get(`${API_BASE_URL}/api/get_school_semester/`)
      .then(res => setSemesters(res.data))
      .catch(console.error);

    axios.get(`${API_BASE_URL}/api/active_school_year`)
      .then(res => {
        if (res.data.length > 0) {
          setSelectedSchoolYear(res.data[0].year_id);
          setSelectedSchoolSemester(res.data[0].semester_id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const departmentIds = getDepartmentIdsFromAdminData(adminData);
    if (!departmentIds.length) return;

    const fetchDepartments = async () => {
      try {
        const responses = await Promise.all(
          departmentIds.map((departmentId) =>
            axios.get(`${API_BASE_URL}/api/departments/${departmentId}`),
          ),
        );
        const mergedDepartments = restrictDepartmentsToScope(
          responses.flatMap((response) => response.data || []),
        );
        const uniqueDepartments = [
          ...new Map(
            mergedDepartments.map((dep) => [String(dep.dprtmnt_id), dep]),
          ).values(),
        ];
        setDepartment(uniqueDepartments);
      } catch (error) {
        console.error("Error fetching departments:", error);
      }
    };

    fetchDepartments();
  }, [adminData.dprtmnt_id, adminData.dprtmnt_ids, scopeRevision]);

  useEffect(() => {
    const departmentIds = getDepartmentIdsFromAdminData(adminData);
    if (!departmentIds.length) return;

    const fetchCurriculums = async () => {
      try {
        const responses = await Promise.all(
          departmentIds.map((departmentId) =>
            axios.get(`${API_BASE_URL}/api/applied_program/${departmentId}`),
          ),
        );
        const merged = responses.flatMap((response) => response.data || []);
        const restrictedCurriculums = restrictToRegistrarCurriculum(merged);
        setAllCurriculums(restrictedCurriculums);
        setCurriculumOptions(restrictedCurriculums);
      } catch (error) {
        console.error("Error fetching curriculum options:", error);
      }
    };

    fetchCurriculums();
  }, [adminData.dprtmnt_id, adminData.dprtmnt_ids, scopeRevision]);

  useEffect(() => {
    const departmentIds = getDepartmentIdsFromAdminData(adminData);
    if (departmentIds.length) return;

    axios.get(`${API_BASE_URL}/api/departments`)
      .then(res => setDepartment(res.data))
      .catch(console.error);

    axios.get(`${API_BASE_URL}/api/applied_program`)
      .then(res => {
        const restrictedCurriculums = restrictToRegistrarCurriculum(res.data);
        setAllCurriculums(restrictedCurriculums);
        setCurriculumOptions(restrictedCurriculums);
      })
      .catch(console.error);
  }, [adminData.dprtmnt_id, adminData.dprtmnt_ids, scopeRevision]);

  useEffect(() => {
    if (department.length === 0 || selectedDepartmentFilter) return;
    const departmentIds = getDepartmentIdsFromAdminData(adminData);
    if (departmentIds.length !== 1) return;
    if (allCurriculums.length === 0) return;

    const firstDeptId = department[0].dprtmnt_id;
    setSelectedDepartmentFilter(firstDeptId);
    handleDepartmentChange(firstDeptId);
  }, [department, allCurriculums, selectedDepartmentFilter, adminData]);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 6 — Apply UI restrictions based on the user's department
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isProgramLocked) return;
    const assignedCurriculum = curriculumOptions.find((prog) =>
      isRegistrarCurriculumMatch(prog.curriculum_id, curriculumOptions)
    );
    if (assignedCurriculum?.curriculum_id) {
      setSelectedProgramFilter(assignedCurriculum.curriculum_id);
    }
  }, [curriculumOptions, isProgramLocked]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Settings effect
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
    if (settings.stepper_color) setStepperColor(settings.stepper_color);
    if (settings.logo_url) setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    else setFetchedLogo(EaristLogo);
    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);
  }, [settings]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSchoolYearChange = e => { setSelectedSchoolYear(e.target.value); setCurrentPage(1); };
  const handleSchoolSemesterChange = e => { setSelectedSchoolSemester(e.target.value); setCurrentPage(1); };

  const handleDepartmentChange = (selectedDept) => {
    setSelectedDepartmentFilter(selectedDept);
    setCurriculumOptions(
      selectedDept ? allCurriculums.filter(o => o.dprtmnt_id === selectedDept) : allCurriculums
    );
    if (!isProgramLocked) setSelectedProgramFilter("");
    setCurrentPage(1);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 7 — Frontend filtering
  // ─────────────────────────────────────────────────────────────────────────────
  const filteredStudents = students
    .filter(s => {
      const matchDept = selectedDepartmentFilter === "" || s.dprtmnt_id === selectedDepartmentFilter;
      const matchProgram = selectedProgramFilter === "" || String(s.curriculum_id) === String(selectedProgramFilter);
      const matchRegistrarScope = isRegistrarStudentScopeMatch(s, allCurriculums);
      const matchYear = selectedSchoolYear === "" || String(s.year_id) === String(selectedSchoolYear);
      const matchSemester = selectedSchoolSemester === "" || String(s.semester_id) === String(selectedSchoolSemester);
      const matchStatus = selectedStatusFilter === ""
        || (selectedStatusFilter === "Regular" && getStudentRegularStatus(s) === 1)
        || (selectedStatusFilter === "Irregular" && getStudentRegularStatus(s) !== 1);
      const matchRemark = selectedRemarkFilter === "" || remarksMap[s.en_remarks] === selectedRemarkFilter;

      return matchDept && matchProgram && matchRegistrarScope && matchYear && matchSemester && matchStatus && matchRemark;
    })
    .sort((a, b) => {
      const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
      const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();
      return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Print
  // ─────────────────────────────────────────────────────────────────────────────
  const printDiv = () => {
    const resolvedAddress = settings?.campus_address?.trim() || settings?.address?.trim() || "No address set in Settings";
    const logoSrc = fetchedLogo || EaristLogo;
    const name = companyName?.trim() || "";
    const words = name.split(" ");
    const mid = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(" ");
    const line2 = words.slice(mid).join(" ");

    const newWin = window.open("", "Print-Window");
    newWin.document.open();
    newWin.document.write(`
<html>
  <head>
    <title>Student List</title>
    <style>
      @page { size: A4; margin: 10mm; }
      body { font-family: Arial; margin: 0; padding: 0; }
      .print-container { display: flex; flex-direction: column; align-items: center; text-align: center; }
      .print-header { display: flex; align-items: center; justify-content: center; position: relative; width: 100%; }
      .print-header img { position: absolute; left: 0; margin-left: 10px; width: 120px; height: 120px; border-radius: 50%; object-fit: cover; }
      table { border-collapse: collapse; width: 100%; margin-top: 20px; border: 1.2px solid black; table-layout: fixed; }
      th, td { border: 1.2px solid black; padding: 4px 6px; font-size: 12px; text-align: center; box-sizing: border-box; }
      th { background-color: #800000; color: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>
  </head>
  <body onload="window.print(); setTimeout(() => window.close(), 100);">
    <div class="print-container">
      <div class="print-header">
        <img src="${logoSrc}" alt="School Logo" />
        <div>
          <div>Republic of the Philippines</div>
          ${name ? `<b style="letter-spacing:1px;font-size:20px;font-family:Arial">${line1}</b>
          ${line2 ? `<div style="letter-spacing:1px;font-size:20px;font-family:Arial"><b>${line2}</b></div>` : ""}` : ""}
          <div style="font-size:12px;">${resolvedAddress}</div>
          <div style="margin-top:30px;"><b style="font-size:20px;letter-spacing:1px;">STUDENT LIST</b></div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Student Number</th><th>Name</th><th>Program Code</th>
            <th>Year Level</th><th>Semester</th><th>Remarks</th>
            <th>Date Enrolled</th><th>Student Status</th>
          </tr>
        </thead>
        <tbody>
          ${filteredStudents.map((s, i) => {
      const prog = curriculumOptions.find(c => String(c.curriculum_id) === String(s.curriculum_id));
      const sem = semesters.find(sm => String(sm.semester_id) === String(s.semester_id));
      return `<tr>
              <td>${i + 1}</td>
              <td>${s.student_number ?? "N/A"}</td>
              <td>${s.last_name}, ${s.first_name} ${s.middle_name ?? ""} ${s.extension ?? ""}</td>
              <td>${prog?.program_code ?? "N/A"}</td>
              <td>${s.year_level_description ?? "N/A"}</td>
              <td>${sem?.semester_description ?? "N/A"}</td>
              <td>${remarksMap[s.en_remarks] ?? "N/A"}</td>
              <td>${s.created_at ? new Date(s.created_at).toLocaleDateString("en-PH") : "N/A"}</td>
              <td>${getStudentRegularLabel(s)}</td>
            </tr>`;
    }).join("")}
        </tbody>
      </table>
    </div>
  </body>
</html>`);
    newWin.document.close();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Guards
  // ─────────────────────────────────────────────────────────────────────────────
  if (loading || hasAccess === null) return <LoadingOverlay open={loading} message="Loading..." />;
  if (!hasAccess) return <Unauthorized />;

  const scopedDepartmentIds = getDepartmentIdsFromAdminData(adminData);
  const isDeptLocked = scopedDepartmentIds.length === 1 && department.length === 1;
  const showAllDepartmentsOption = scopedDepartmentIds.length !== 1;
  const selectedDepartmentFilterValue =
    selectedDepartmentFilter === "" ||
    department.some(
      (dep) => String(dep.dprtmnt_id) === String(selectedDepartmentFilter),
    )
      ? selectedDepartmentFilter
      : "";

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

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
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
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h4"
          sx={{
            fontWeight: 'bold',
            color: titleColor,
            fontSize: '36px',
          }}
        >
          CLASS LIST
        </Typography>



      </Box>

      <hr style={{ border: "1px solid #ccc", width: "100%" }} />

      <br />
      <br />
      <CollegeEnrollmentTabs />
      <br />
      <br />


      {/* ── Pagination bar ── */}
      <TableContainer component={Paper} sx={{ width: "100%" }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
            <TableRow>
              <TableCell colSpan={10} sx={{ border: `1px solid ${borderColor}`, py: 0.5, backgroundColor: settings?.header_color || "#1976d2", color: "white" }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography fontSize="14px" fontWeight="bold" color="white">
                    Total Students: {filteredStudents.length}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    {[
                      { label: "First", onClick: () => setCurrentPage(1), disabled: currentPage === 1 },
                      { label: "Prev", onClick: () => setCurrentPage(p => Math.max(p - 1, 1)), disabled: currentPage === 1 },
                    ].map(btn => (
                      <Button key={btn.label} onClick={btn.onClick} disabled={btn.disabled} variant="outlined" size="small"
                        sx={{
                          minWidth: 80, color: "white", borderColor: "white", backgroundColor: "transparent",
                          "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
                          "&.Mui-disabled": { color: "white", borderColor: "white", opacity: 1 }
                        }}>
                        {btn.label}
                      </Button>
                    ))}

                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select value={currentPage} onChange={e => setCurrentPage(Number(e.target.value))}
                        sx={{
                          fontSize: "12px", height: 36, color: "white", border: "1px solid white", backgroundColor: "transparent",
                          ".MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                          "& svg": { color: "white" }
                        }}
                        MenuProps={{ PaperProps: { sx: { maxHeight: 200 } } }}>
                        {Array.from({ length: totalPages }, (_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>Page {i + 1}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Typography fontSize="11px" color="white">{totalPages} page{totalPages > 1 ? "s" : ""}</Typography>

                    {[
                      { label: "Next", onClick: () => setCurrentPage(p => Math.min(p + 1, totalPages)), disabled: currentPage === totalPages },
                      { label: "Last", onClick: () => setCurrentPage(totalPages), disabled: currentPage === totalPages },
                    ].map(btn => (
                      <Button key={btn.label} onClick={btn.onClick} disabled={btn.disabled} variant="outlined" size="small"
                        sx={{
                          minWidth: 80, color: "white", borderColor: "white", backgroundColor: "transparent",
                          "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
                          "&.Mui-disabled": { color: "white", borderColor: "white", opacity: 1 }
                        }}>
                        {btn.label}
                      </Button>
                    ))}

                    <Button onClick={() => setSortOrder(p => p === "asc" ? "desc" : "asc")} variant="outlined" size="small"
                      sx={{
                        minWidth: 100, color: "white", borderColor: "white", backgroundColor: "transparent",
                        "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" }
                      }}>
                      Sort: {sortOrder === "asc" ? "A–Z" : "Z–A"}
                    </Button>
                  </Box>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>

      {/* ── Filter panel ── */}
      <TableContainer component={Paper} sx={{ width: "100%", border: `1px solid ${borderColor}`, p: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", flexWrap: "wrap", gap: "2rem" }}>

          {/* Row 1: print */}
          <Box sx={{ display: "flex", gap: "1rem", justifyContent: "space-between" }}>
            <button onClick={printDiv}
              style={{
                padding: "5px 20px", border: "2px solid black", backgroundColor: "#f0f0f0", color: "black",
                borderRadius: "5px", cursor: "pointer", fontSize: "14px", fontWeight: "bold",
                transition: "background-color 0.3s, transform 0.2s", height: "40px",
                display: "flex", alignItems: "center", gap: "8px", maxWidth: "220px", userSelect: "none"
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#d3d3d3"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "#f0f0f0"}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
              type="button">
              <FcPrint size={20} /> Print Student List
            </button>
          </Box>

          {/* Row 2: status / remarks | school year / semester | department / program */}
          <Box display="flex" justifyContent="space-between">

            {/* Left column */}
            <Box display="flex" flexDirection="column" gap={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography fontSize={13} sx={{ minWidth: "100px" }}>Student Status:</Typography>
                <FormControl size="small" sx={{ width: "200px" }}>
                  <Select value={selectedStatusFilter} onChange={e => { setSelectedStatusFilter(e.target.value); setCurrentPage(1); }} displayEmpty>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="Regular">Regular</MenuItem>
                    <MenuItem value="Irregular">Irregular</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography fontSize={13} sx={{ minWidth: "100px" }}>Remarks:</Typography>
                <FormControl size="small" sx={{ width: "200px" }}>
                  <Select value={selectedRemarkFilter} onChange={e => { setSelectedRemarkFilter(e.target.value); setCurrentPage(1); }} displayEmpty>
                    <MenuItem value="">All</MenuItem>
                    {Object.values(remarksMap).map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* Middle column */}
            <Box display="flex" flexDirection="column" gap={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography fontSize={13} sx={{ minWidth: "100px" }}>School Year:</Typography>
                <FormControl size="small" sx={{ width: "200px" }}>
                  <InputLabel>School Years</InputLabel>
                  <Select label="School Years" value={selectedSchoolYear} onChange={handleSchoolYearChange} displayEmpty>
                    {schoolYears.length > 0
                      ? schoolYears.map(sy => <MenuItem key={sy.year_id} value={sy.year_id}>{sy.current_year} - {sy.next_year}</MenuItem>)
                      : <MenuItem disabled>Not found</MenuItem>}
                  </Select>
                </FormControl>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography fontSize={13} sx={{ minWidth: "100px" }}>Semester:</Typography>
                <FormControl size="small" sx={{ width: "200px" }}>
                  <InputLabel>School Semester</InputLabel>
                  <Select label="School Semester" value={selectedSchoolSemester} onChange={handleSchoolSemesterChange} displayEmpty>
                    {semesters.length > 0
                      ? semesters.map(s => <MenuItem key={s.semester_id} value={s.semester_id}>{s.semester_description}</MenuItem>)
                      : <MenuItem disabled>Not found</MenuItem>}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            {/* Right column — department locked for assigned admins */}
            <Box display="flex" flexDirection="column" gap={2}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography fontSize={13} sx={{ minWidth: "100px" }}>Department:</Typography>
                <Tooltip
                  title={isDeptLocked ? "Your account is assigned to a single department." : ""}
                  placement="top"
                  disableHoverListener={!isDeptLocked}
                >
                  <span style={{ display: "inline-block" }}>
                    <FormControl size="small" sx={{ width: "400px" }} disabled={isDeptLocked}>
                      <Select
                        value={selectedDepartmentFilterValue}
                        onChange={e => { if (!isDeptLocked) handleDepartmentChange(e.target.value); }}
                        displayEmpty
                        sx={isDeptLocked ? { backgroundColor: "#f5f5f5", cursor: "not-allowed" } : {}}
                      >
                        {!isDeptLocked && showAllDepartmentsOption && (
                          <MenuItem value="">All Departments</MenuItem>
                        )}
                        {department.map(dep => (
                          <MenuItem key={dep.dprtmnt_id} value={dep.dprtmnt_id}>
                            {dep.dprtmnt_name} ({dep.dprtmnt_code})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </span>
                </Tooltip>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography fontSize={13} sx={{ minWidth: "100px" }}>Program:</Typography>
                <FormControl size="small" sx={{ width: "400px" }}>
                  <Select value={selectedProgramFilter} onChange={e => { setSelectedProgramFilter(e.target.value); setCurrentPage(1); }} disabled={isProgramLocked} displayEmpty>
                    {!isProgramLocked && <MenuItem value="">All Programs</MenuItem>}
                    {curriculumOptions.map(p => (
                      <MenuItem key={p.curriculum_id} value={p.curriculum_id}>
                        {p.program_code} - {p.program_description}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

          </Box>
        </Box>
      </TableContainer>

      {/* ── Students table ── */}
      <TableContainer component={Paper} sx={{ width: "100%", marginTop: "2rem" }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
            <TableRow>
              {["#", "Student Number", "Name", "Program Description", "Program Code",
                "Year Level", "Semester", "Remarks", "Date Enrolled", "Student Status"].map(h => (
                  <TableCell key={h} sx={{ color: "white", textAlign: "center", fontSize: "12px", border: `1px solid ${borderColor}` }}>
                    {h}
                  </TableCell>
                ))}
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              border: `1px solid ${borderColor}`,
              "& .MuiTableRow-root:nth-of-type(odd)": {
                backgroundColor: "#ffffff",
              },
              "& .MuiTableRow-root:nth-of-type(even)": {
                backgroundColor: "lightgray",
              },
            }}
          >
            {paginatedStudents.map((s, i) => (
              <TableRow key={`${s.student_number}-${i}`}>
                <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                  {(currentPage - 1) * itemsPerPage + i + 1}
                </TableCell>
                <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{s.student_number}</TableCell>
                <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                  {s.last_name}, {s.first_name} {s.middle_name || ""}
                </TableCell>
                <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{s.program_description}</TableCell>
                <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{s.program_code}</TableCell>
                <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{s.year_level_description}</TableCell>
                <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{s.semester_description}</TableCell>
                <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{remarksMap[s.en_remarks] || ""}</TableCell>
                <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>{s.created_at || ""}</TableCell>
                <TableCell sx={{ textAlign: "center", border: `1px solid ${borderColor}` }}>
                  {getStudentRegularLabel(s)}
                </TableCell>
              </TableRow>
            ))}
            {paginatedStudents.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: "center", border: `1px solid ${borderColor}`, color: "#777", py: 3 }}>
                  No students found for the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

    </Box>
  );
};

export default ClassRoster;
