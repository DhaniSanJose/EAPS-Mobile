import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  Button,
  Typography,
  Paper,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  FormControl,
  Select,
  Card,
  TableCell,
  TextField,
  MenuItem,
  InputLabel,
  TableBody,
} from "@mui/material";
import API_BASE_URL from "../apiConfig";
import { Snackbar, Alert } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import { FcPrint } from "react-icons/fc";
import EaristLogo from "../assets/EaristLogo.png";
import SchoolIcon from "@mui/icons-material/School";
import AssignmentIcon from "@mui/icons-material/Assignment";
import ScheduleIcon from "@mui/icons-material/Schedule";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import {
  isRegistrarCurriculumMatch,
  isRegistrarProgramSelectionLocked,
  restrictToRegistrarCurriculum,
  syncRegistrarScopeFromAdminData,
  getDepartmentIdsFromAdminData,
} from "../utils/registrarCurriculumRestriction";
import useRegistrarScopeRevision from "../hooks/useRegistrarScopeRevision";
import SearchIcon from "@mui/icons-material/Search";
import ScoreIcon from "@mui/icons-material/Score";
import DateField from "../components/DateField";
import PersonIcon from "@mui/icons-material/Person";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";

// ────────────────────────────────────────────────────────────────
// READ-ONLY VIEW of Qualifying / Interview Exam Scores
// Modeled after ApplicantScoringReadOnly.jsx (view-only for registrar)
// No saving, importing, assigning, unassigning, status changes, or
// email sending — this page is for viewing/printing only.
// ────────────────────────────────────────────────────────────────

const QualifyingExamScoreReadOnly = () => {
  const settings = useContext(SettingsContext);

  const [titleColor, setTitleColor] = useState("#000000");
  const [borderColor, setBorderColor] = useState("#000000");

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [campusAddress, setCampusAddress] = useState("");
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    if (!settings) return;

    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.border_color) setBorderColor(settings.border_color);

    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    } else {
      setFetchedLogo(EaristLogo);
    }

    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.campus_address) setCampusAddress(settings.campus_address);

    if (settings?.branches) {
      try {
        const parsed =
          typeof settings.branches === "string"
            ? JSON.parse(settings.branches)
            : settings.branches;
        setBranches(parsed);
      } catch (err) {
        console.error("Failed to parse branches:", err);
        setBranches([]);
      }
    }
  }, [settings]);

  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const queryPersonId = (queryParams.get("person_id") || "").trim();

  const handleRowClick = (applicant) => {
    const personId = applicant?.person_id;
    if (!personId) return;

    const searchValue =
      applicant?.applicant_number ||
      `${applicant?.last_name ?? ""}, ${applicant?.first_name ?? ""}`.trim();

    sessionStorage.setItem("admin_edit_person_id", String(personId));
    sessionStorage.setItem("edit_person_id", String(personId));
    sessionStorage.setItem("admin_edit_person_id_source", "applicant_list");
    sessionStorage.setItem("admin_edit_person_id_ts", String(Date.now()));
    sessionStorage.setItem("admin_edit_person_data", JSON.stringify(applicant));

    if (searchValue) {
      sessionStorage.setItem("admin_edit_search_query", String(searchValue));
      sessionStorage.setItem("edit_applicant_number", String(searchValue));
    }

    navigate(`/applicant_college_personal_information?person_id=${personId}`);
  };

  const tabs = [
    {
      label: "Applicant List",
      to: "/applicant_list_registrar",
      icon: <SchoolIcon fontSize="large" />,
    },
    {
      label: "Applicant Profile",
      to: "/applicant_registrar_personal_information",
      icon: <PersonIcon fontSize="large" />,
    },
    {
      label: "Applicant Online Requirements",
      to: "/applicant_online_requirements_registrar",
      icon: <AssignmentIcon fontSize="large" />,
    },
    {
      label: "Entrance Examination Score",
      to: "/registrar_entrance_examination_score",
      icon: <ScoreIcon fontSize="large" />,
    },

    {
      label: "Qualifying / Interview Exam Score",
      to: "/registrar_qualifying_interview_score",
      icon: <ScoreIcon fontSize="large" />,
    },

    {
      label: "Student Numbering Panel",
      to: "/student_numbering",
      icon: <FormatListNumberedIcon fontSize="large" />,
    },

  ];


  const [activeStep, setActiveStep] = useState(4);

  const handleStepClick = (index, to) => {
    setActiveStep(index);
    const pid = sessionStorage.getItem("admin_edit_person_id");
    if (pid) {
      navigate(`${to}?person_id=${pid}`);
    } else {
      navigate(to);
    }
  };

  // NOTE: adjust this pageId to whatever is registered for the
  // read-only view in the page_access table (do not reuse the
  // editable page's id).
  const pageId = 152;

  const [hasAccess, setHasAccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [employeeID, setEmployeeID] = useState("");
  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [adminData, setAdminData] = useState({ dprtmnt_id: "", dprtmnt_ids: [] });

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
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const loggedInPersonId = localStorage.getItem("person_id");
    const searchedPersonId = sessionStorage.getItem("admin_edit_person_id");

    if (!storedUser || !storedRole || !loggedInPersonId) {
      window.location.href = "/login";
      return;
    }

    const allowedRoles = ["registrar", "applicant", "superadmin"];
    if (allowedRoles.includes(storedRole)) {
      const targetId = queryPersonId || searchedPersonId || loggedInPersonId;
      sessionStorage.setItem("admin_edit_person_id", targetId);
      setUserID(targetId);
      return;
    }

    window.location.href = "/login";
  }, [queryPersonId]);

  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "info" });
  const [person, setPerson] = useState({
    campus: "",
    fromDate: "",
    toDate: "",
  });

  const [persons, setPersons] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const fetchApplicants = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/applicants-with-number`);

      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      const fetchedSubjects = Array.isArray(res.data?.subjects) ? res.data.subjects : [];

      const normalized = data.map((p) => ({
        ...p,
        college_approval_status: Number(p.college_approval_status ?? 0),
        qualifying_exam_score: Number(p.qualifying_exam_score) || 0,
        qualifying_interview_score: Number(p.qualifying_interview_score) || 0,
        qualifying_status: p.qualifying_status ?? null,
        interview_status_result: p.interview_status_result ?? null,
      }));

      setPersons(normalized);
      setSubjects(fetchedSubjects);
    } catch (err) {
      console.error("Error fetching applicants:", err);
      setPersons([]);
    }
  };

  useEffect(() => {
    fetchApplicants();
  }, [adminData.dprtmnt_id, adminData.dprtmnt_ids]);

  const fetchSubjects = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/subjects`);
      setSubjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchPersonData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin_data/${user}`);
      setAdminData(res.data);
      syncRegistrarScopeFromAdminData(res.data);
    } catch (err) {
      console.error("Error fetching admin data:", err);
    }
  };

  useEffect(() => {
    if (user) fetchPersonData();
  }, [user]);

  const [curriculumOptions, setCurriculumOptions] = useState([]);
  const scopeRevision = useRegistrarScopeRevision();
  const [allCurriculums, setAllCurriculums] = useState([]);

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
        const restricted = restrictToRegistrarCurriculum(merged);
        setAllCurriculums(restricted);
        setCurriculumOptions(restricted);
      } catch (error) {
        console.error("Error fetching curriculum options:", error);
      }
    };
    fetchCurriculums();
  }, [adminData.dprtmnt_id, adminData.dprtmnt_ids, scopeRevision]);

  useEffect(() => {
    const departmentIds = getDepartmentIdsFromAdminData(adminData);
    if (departmentIds.length) return;

    axios.get(`${API_BASE_URL}/api/applied_program`).then((res) => {
      const restrictedCurriculums = restrictToRegistrarCurriculum(res.data);
      setAllCurriculums(restrictedCurriculums);
      setCurriculumOptions(restrictedCurriculums);
    });
  }, [adminData.dprtmnt_id, adminData.dprtmnt_ids, scopeRevision]);

  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("");
  const [selectedProgramFilter, setSelectedProgramFilter] = useState("");
  const isProgramLocked = isRegistrarProgramSelectionLocked();
  const [department, setDepartment] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);
  const [semesters, setSchoolSemester] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [selectedSchoolSemester, setSelectedSchoolSemester] = useState("");

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
    axios
      .get(`${API_BASE_URL}/api/active_school_year`)
      .then((res) => {
        if (res.data.length > 0) {
          setSelectedSchoolYear(res.data[0].year_id);
          setSelectedSchoolSemester(res.data[0].semester_id);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleSchoolYearChange = (event) => setSelectedSchoolYear(event.target.value);
  const handleSchoolSemesterChange = (event) => setSelectedSchoolSemester(event.target.value);

  const normalize = (s) => (s ?? "").toString().trim().toLowerCase();
  const selectedSemester = semesters.find(
    (sem) => String(sem.semester_id) === String(selectedSchoolSemester),
  );

  const [topCount, setTopCount] = useState(100);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [minTotal, setMinTotal] = useState("");
  const [minScorePercent, setMinScorePercent] = useState("");

  const filteredPersons = persons.filter((personData) => {
    const query = searchQuery.toLowerCase();
    const fullName =
      `${personData.first_name ?? ""} ${personData.middle_name ?? ""} ${personData.last_name ?? ""}`.toLowerCase();

    const matchesApplicantID = personData.applicant_number
      ?.toString()
      .toLowerCase()
      .includes(query);
    const matchesName = fullName.includes(query);
    const matchesEmail = personData.emailAddress?.toLowerCase().includes(query);

    const matchesCampus = !person.campus || personData.campus === person.campus;

    const programInfo = allCurriculums.find(
      (opt) => opt.curriculum_id?.toString() === personData.program?.toString(),
    );
    const matchesRegistrarCurriculum = isRegistrarCurriculumMatch(personData.program);

    const matchesProgramQuery = programInfo?.program_code?.toLowerCase().includes(query);

    const matchesDepartment =
      selectedDepartmentFilter === "" ||
      programInfo?.dprtmnt_name === selectedDepartmentFilter;

    const matchesProgramFilter =
      selectedProgramFilter === "" ||
      programInfo?.program_code === selectedProgramFilter;

    const appliedDate = new Date(personData.created_at.split("T")[0]);
    const applicantAppliedYear = appliedDate.getFullYear();

    const schoolYear = schoolYears.find((sy) => sy.year_id === selectedSchoolYear);

    const matchesSchoolYear =
      selectedSchoolYear === "" ||
      (schoolYear && String(applicantAppliedYear) === String(schoolYear.current_year));

    const matchesSemester =
      selectedSchoolSemester === "" ||
      normalize(personData.middle_code) === normalize(selectedSemester?.semester_code);

    const subjectScores = subjects.map((subject) => Number(personData.scores?.[subject.id] ?? 0));
    const total = subjectScores.reduce((sum, score) => sum + score, 0);
    const maxTotal = subjects.reduce((sum, subject) => sum + Number(subject.max_score || 0), 0);
    const scorePercent = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

    const matchesTotal =
      minTotal === "" || (total >= Number(minTotal) && total < Number(minTotal) + 1);

    const matchesScorePercent =
      minScorePercent === "" ||
      (scorePercent >= Number(minScorePercent) && scorePercent < Number(minScorePercent) + 1);

    return (
      (matchesApplicantID || matchesName || matchesEmail || matchesProgramQuery) &&
      matchesDepartment &&
      matchesRegistrarCurriculum &&
      matchesProgramFilter &&
      matchesSchoolYear &&
      matchesSemester &&
      matchesCampus &&
      matchesTotal &&
      matchesScorePercent
    );
  });

  const sortedPersons = React.useMemo(() => {
    return filteredPersons
      .slice()
      .sort((a, b) => {
        const aTotal =
          (Number(a.qualifying_exam_score) + Number(a.qualifying_interview_score)) / 2;
        const bTotal =
          (Number(b.qualifying_exam_score) + Number(b.qualifying_interview_score)) / 2;

        if (bTotal !== aTotal) return bTotal - aTotal;

        const dateA = new Date(a.created_at.split("T")[0]);
        const dateB = new Date(b.created_at.split("T")[0]);
        return dateA - dateB;
      })
      .slice(0, topCount);
  }, [filteredPersons, topCount]);

  const totalPages = Math.ceil(sortedPersons.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPersons = sortedPersons.slice(indexOfFirstItem, indexOfLastItem);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages || 1);
    }
  }, [sortedPersons.length, totalPages]);

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
        const mergedDepartments = responses.flatMap((response) => response.data || []);
        const uniqueDepartments = [
          ...new Map(mergedDepartments.map((dep) => [String(dep.dprtmnt_id), dep])).values(),
        ];
        setDepartment(uniqueDepartments);
      } catch (error) {
        console.error("Error fetching departments:", error);
      }
    };
    fetchDepartments();
  }, [adminData.dprtmnt_id, adminData.dprtmnt_ids, scopeRevision]);

  const handleDepartmentChange = (selectedDept) => {
    setSelectedDepartmentFilter(selectedDept);
    if (!selectedDept) {
      setCurriculumOptions(allCurriculums);
    } else {
      setCurriculumOptions(allCurriculums.filter((opt) => opt.dprtmnt_name === selectedDept));
    }
    if (!isProgramLocked) setSelectedProgramFilter("");
    setCurrentPage(1);
  };

  useEffect(() => {
    if (department.length > 0 && !selectedDepartmentFilter) {
      const firstDept = department[0].dprtmnt_name;
      setSelectedDepartmentFilter(firstDept);
      handleDepartmentChange(firstDept);
    }
  }, [department, selectedDepartmentFilter]);

  useEffect(() => {
    if (!isProgramLocked) return;
    const assignedCurriculum = curriculumOptions.find((prog) =>
      isRegistrarCurriculumMatch(prog.curriculum_id),
    );
    if (assignedCurriculum?.program_code) {
      setSelectedProgramFilter(assignedCurriculum.program_code);
    }
  }, [curriculumOptions, isProgramLocked]);

  const handleSnackClose = (_, reason) => {
    if (reason === "clickaway") return;
    setSnack((prev) => ({ ...prev, open: false }));
  };

  // Auto-load a single applicant when arriving with ?person_id=
  useEffect(() => {
    const personIdFromUrl = queryParams.get("person_id");
    if (!personIdFromUrl) return;

    axios
      .get(`${API_BASE_URL}/api/person_with_applicant/${personIdFromUrl}`)
      .then((res) => {
        if (res.data?.applicant_number) {
          setSearchQuery(res.data.applicant_number);
        }
      })
      .catch((err) => console.error("Auto search failed:", err));
  }, [location.search]);

  // ── PRINT (view/report only — no editing controls) ──
  const divToPrintRef = useRef();

  const printDiv = () => {
    const newWin = window.open("", "Print-Window");
    newWin.document.open();

    const logoSrc = fetchedLogo || EaristLogo;
    const name = companyName?.trim() || "";

    const words = name.split(" ");
    const middleIndex = Math.ceil(words.length / 2);
    const firstLine = words.slice(0, middleIndex).join(" ");
    const secondLine = words.slice(middleIndex).join(" ");

    let resolvedCampusAddress = "";
    if (settings?.campus_address && settings.campus_address.trim() !== "") {
      resolvedCampusAddress = settings.campus_address;
    } else if (settings?.address && settings.address.trim() !== "") {
      resolvedCampusAddress = settings.address;
    } else {
      resolvedCampusAddress = "No address set in Settings";
    }

    const htmlContent = `
  <html>
    <head>
      <title>Qualifying Examination Score</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial; margin: 0; padding: 0; }
        .print-container { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 0 15px; }
        .print-header { display: flex; align-items: center; justify-content: center; gap: 20px; width: 100%; margin-top: 20px; }
        .print-header img { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; }
        .header-text { text-align: center; }
        .header-text .gov { font-size: 13px; }
        .header-text .school-name { font-size: 20px; font-weight: bold; letter-spacing: 1px; font-family: Arial; }
        .header-text .address { font-size: 13px; margin-top: 2px; }
        .header-text .title { margin-top: 25px; font-size: 22px; font-weight: bold; letter-spacing: 1px; }
        table { border-collapse: collapse; width: 100%; margin-top: 25px; border: 1.5px solid black; table-layout: fixed; }
        th, td { border: 1.5px solid black; padding: 7px 8px; font-size: 13px; text-align: center; word-wrap: break-word; }
        th { background-color: lightgray; color: black; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        th:last-child, td:last-child { border-right: 1.5px solid black !important; }
      </style>
    </head>

    <body onload="window.print(); setTimeout(() => window.close(), 100);">
      <div class="print-container">
        <div class="print-header">
          <img src="${logoSrc}" alt="School Logo"/>
          <div class="header-text">
            <div style="font-size: 13px; font-family: Arial">Republic of the Philippines</div>
            ${name
        ? `
              <div class="school-name">${firstLine}</div>
              ${secondLine ? `<div class="school-name">${secondLine}</div>` : ""}
            `
        : ""
      }
            <div class="address">${resolvedCampusAddress}</div>
            <div class="title">QUALIFYING EXAMINATION SCORE</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:12%">Applicant ID</th>
              <th style="width:25%">Applicant Name</th>
              <th style="width:12%">Program</th>
              <th style="width:10%">Qualifying Exam Score</th>
              <th style="width:10%">Qualifying Status</th>
              <th style="width:10%">Interview Exam Score</th>
              <th style="width:10%">Interview Status</th>
              <th style="width:10%">Total Avg</th>
              <th style="width:10%">Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPersons
        .map((p) => {
          const qualifyingExam = p.qualifying_exam_score ?? 0;
          const qualifyingInterview = p.qualifying_interview_score ?? 0;
          const computedTotalAve = (Number(qualifyingExam) + Number(qualifyingInterview)) / 2;

          const statusLabel =
            Number(p.college_approval_status) === 1
              ? "Accepted"
              : Number(p.college_approval_status) === 2
                ? "Rejected"
                : "Waiting List";

          const qualifyingStatusLabel =
            p.qualifying_status === 0 ? "Passed" : p.qualifying_status === 1 ? "Failed" : "—";
          const interviewStatusLabel =
            p.interview_status_result === 0
              ? "Passed"
              : p.interview_status_result === 1
                ? "Failed"
                : "—";

          return `
                <tr>
                  <td>${p.applicant_number ?? "N/A"}</td>
                  <td>${p.last_name}, ${p.first_name} ${p.middle_name ?? ""} ${p.extension ?? ""}</td>
                  <td>${allCurriculums.find(
            (item) => item.curriculum_id?.toString() === p.program?.toString(),
          )?.program_code ?? "N/A"
            }</td>
                  <td>${qualifyingExam}</td>
                  <td>${qualifyingStatusLabel}</td>
                  <td>${qualifyingInterview}</td>
                  <td>${interviewStatusLabel}</td>
                  <td>${computedTotalAve.toFixed(2)}</td>
                  <td>${statusLabel}</td>
                </tr>
              `;
        })
        .join("")}
          </tbody>
        </table>
      </div>
    </body>
  </html>
  `;

    newWin.document.write(htmlContent);
    newWin.document.close();
  };

  // 🔒 Disable right-click
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // 🔒 Block DevTools shortcuts + Ctrl+P silently
  document.addEventListener("keydown", (e) => {
    const isBlockedKey =
      e.key === "F12" ||
      e.key === "F11" ||
      (e.ctrlKey && e.shiftKey && (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) ||
      (e.ctrlKey && e.key.toLowerCase() === "u") ||
      (e.ctrlKey && e.key.toLowerCase() === "p");

    if (isBlockedKey) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  if (loading || hasAccess === null) {
    return <LoadingOverlay open={loading} message="Loading..." />;
  }

  if (!hasAccess) {
    return <Unauthorized />;
  }

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
          QUALIFYING / INTERVIEW EXAMINATION SCORE 
        </Typography>

        <TextField
          variant="outlined"
          placeholder="Search Applicant Name / Email / Applicant ID"
          size="small"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          sx={{
            width: 450,
            backgroundColor: "#fff",
            borderRadius: 1,
            "& .MuiOutlinedInput-root": { borderRadius: "10px" },
          }}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} /> }}
        />
      </Box>

      <hr style={{ border: "1px solid #ccc", width: "100%" }} />
      <br />
      <br />

      <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "nowrap", width: "100%", gap: 2 }}>
        {tabs.map((tab, index) => (
          <Card
            key={index}
            onClick={() => handleStepClick(index, tab.to)}
            sx={{
              flex: `1 1 ${100 / tabs.length}%`,
              height: 135,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              borderRadius: 2,
              border: `1px solid ${borderColor}`,
              backgroundColor: activeStep === index ? settings?.header_color || "#1976d2" : "#E8C999",
              color: activeStep === index ? "#fff" : "#000",
              boxShadow: activeStep === index ? "0px 4px 10px rgba(0,0,0,0.3)" : "0px 2px 6px rgba(0,0,0,0.15)",
              transition: "0.3s ease",
              "&:hover": { backgroundColor: activeStep === index ? "#000000" : "#f5d98f" },
            }}
          >
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Box sx={{ fontSize: 40, mb: 1 }}>{tab.icon}</Box>
              <Typography sx={{ fontSize: 14, fontWeight: "bold", textAlign: "center" }}>
                {tab.label}
              </Typography>
            </Box>
          </Card>
        ))}
      </Box>

      <br />
      <br />

      <TableContainer component={Paper} sx={{ width: "100%", border: `1px solid ${borderColor}` }}>
        <Table>
          <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
            <TableRow>
              <TableCell sx={{ color: "white", textAlign: "Center" }}>
                Qualifying / Interview Examination Score (Read Only)
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>

      <TableContainer component={Paper} sx={{ width: "100%", border: `1px solid ${borderColor}`, p: 2 }}>
        <Box display="flex" justifyContent="space-between" flexWrap="wrap" rowGap={2}>
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="flex-end" gap={2}>
              <FormControl size="small" sx={{ width: 200 }}>
                <InputLabel shrink htmlFor="from-date">From Date</InputLabel>
                <DateField
                  id="from-date"
                  size="small"
                  name="fromDate"
                  value={person.fromDate || ""}
                  onChange={(e) => setPerson((prev) => ({ ...prev, fromDate: e.target.value }))}
                />
              </FormControl>
            </Box>

            <Box display="flex" alignItems="flex-end" gap={2}>
              <FormControl size="small" sx={{ width: 200 }}>
                <InputLabel shrink htmlFor="to-date">To Date</InputLabel>
                <DateField
                  id="to-date"
                  size="small"
                  name="toDate"
                  value={person.toDate || ""}
                  onChange={(e) => setPerson((prev) => ({ ...prev, toDate: e.target.value }))}
                />
              </FormControl>
            </Box>
          </Box>

          <Box display="flex" alignItems="flex-end" gap={2}>
            <Box display="flex" flexDirection="column" gap={1}>
              <Typography fontSize={13}>Campus:</Typography>
              <FormControl size="small" sx={{ width: "200px" }}>
                <InputLabel id="campus-label">Campus</InputLabel>
                <Select
                  labelId="campus-label"
                  id="campus-select"
                  name="campus"
                  value={person.campus ?? ""}
                  onChange={(e) => {
                    setPerson((prev) => ({ ...prev, campus: e.target.value }));
                    setCurrentPage(1);
                  }}
                >
                  <MenuItem value=""><em>All Campuses</em></MenuItem>
                  {branches.map((branch) => (
                    <MenuItem key={branch.id} value={branch.id}>
                      {branch.branch}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <button
              onClick={printDiv}
              style={{
                padding: "5px 20px",
                border: "2px solid black",
                backgroundColor: "#f0f0f0",
                color: "black",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                transition: "background-color 0.3s, transform 0.2s",
                height: "40px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                userSelect: "none",
                width: "315px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#d3d3d3")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              type="button"
            >
              <FcPrint size={20} />
              Print Qualifying / Interview Scores
            </button>
          </Box>
        </Box>
      </TableContainer>

      <TableContainer component={Paper} sx={{ width: "100%" }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "#6D2323", color: "white" }}>
            <TableRow>
              <TableCell
                colSpan={10}
                sx={{ border: `1px solid ${borderColor}`, py: 0.5, backgroundColor: settings?.header_color || "#1976d2", color: "white" }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography fontSize="14px" fontWeight="bold" color="white">
                    Total Applicants: {filteredPersons.length}
                  </Typography>

                  <Box display="flex" alignItems="center" gap={1}>
                    <Button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80, color: "white", borderColor: "white", backgroundColor: "transparent",
                        "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
                        "&.Mui-disabled": { color: "white", borderColor: "white", backgroundColor: "transparent", opacity: 1 },
                      }}
                    >
                      First
                    </Button>

                    <Button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80, color: "white", borderColor: "white", backgroundColor: "transparent",
                        "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
                        "&.Mui-disabled": { color: "white", borderColor: "white", backgroundColor: "transparent", opacity: 1 },
                      }}
                    >
                      Prev
                    </Button>

                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={currentPage}
                        onChange={(e) => setCurrentPage(Number(e.target.value))}
                        displayEmpty
                        sx={{
                          fontSize: "12px", height: 36, color: "white", border: "1px solid white", backgroundColor: "transparent",
                          ".MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                          "& svg": { color: "white" },
                        }}
                        MenuProps={{ PaperProps: { sx: { maxHeight: 200, backgroundColor: "#fff" } } }}
                      >
                        {Array.from({ length: totalPages }, (_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>Page {i + 1}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Typography fontSize="11px" color="white">
                      of {totalPages} page{totalPages > 1 ? "s" : ""}
                    </Typography>

                    <Button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80, color: "white", borderColor: "white", backgroundColor: "transparent",
                        "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
                        "&.Mui-disabled": { color: "white", borderColor: "white", backgroundColor: "transparent", opacity: 1 },
                      }}
                    >
                      Next
                    </Button>

                    <Button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80, color: "white", borderColor: "white", backgroundColor: "transparent",
                        "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
                        "&.Mui-disabled": { color: "white", borderColor: "white", backgroundColor: "transparent", opacity: 1 },
                      }}
                    >
                      Last
                    </Button>
                  </Box>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>

      <TableContainer component={Paper} sx={{ width: "100%", border: `1px solid ${borderColor}`, p: 2 }}>
        <Box display="flex" justifyContent="space-between" flexWrap="wrap" rowGap={3} columnGap={5}>
          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "10px" }}>Sort By:</Typography>
              <FormControl size="small" sx={{ width: "200px" }}>
                <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} displayEmpty>
                  <MenuItem value="">Select Field</MenuItem>
                  <MenuItem value="name">Applicant's Name</MenuItem>
                  <MenuItem value="id">Applicant ID</MenuItem>
                  <MenuItem value="email">Email Address</MenuItem>
                </Select>
              </FormControl>
              <Typography fontSize={13} sx={{ minWidth: "10px" }}>Sort Order:</Typography>
              <FormControl size="small" sx={{ width: "200px" }}>
                <Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} displayEmpty>
                  <MenuItem value="">Select Order</MenuItem>
                  <MenuItem value="asc">Ascending</MenuItem>
                  <MenuItem value="desc">Descending</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "80px", textAlign: "right" }}>
                Top Highest:
              </Typography>
              <FormControl size="small" sx={{ width: 120 }}>
                <Select
                  value={topCount}
                  onChange={(e) => {
                    setTopCount(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <MenuItem value={10}>Top 10</MenuItem>
                  <MenuItem value={25}>Top 25</MenuItem>
                  <MenuItem value={50}>Top 50</MenuItem>
                  <MenuItem value={100}>Top 100</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "100px" }}>School Year:</Typography>
              <FormControl size="small" sx={{ width: "200px" }}>
                <InputLabel id="school-year-label">School Years</InputLabel>
                <Select labelId="school-year-label" value={selectedSchoolYear} onChange={handleSchoolYearChange} displayEmpty>
                  {schoolYears.length > 0 ? (
                    schoolYears.map((sy) => (
                      <MenuItem value={sy.year_id} key={sy.year_id}>
                        {sy.current_year} - {sy.next_year}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>School Year is not found</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "100px" }}>Semester:</Typography>
              <FormControl size="small" sx={{ width: "200px" }}>
                <InputLabel id="semester-label">School Semester</InputLabel>
                <Select labelId="semester-label" value={selectedSchoolSemester} onChange={handleSchoolSemesterChange} displayEmpty>
                  {semesters.length > 0 ? (
                    semesters.map((sem) => (
                      <MenuItem value={sem.semester_id} key={sem.semester_id}>
                        {sem.semester_description}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>School Semester is not found</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box display="flex" flexDirection="column" gap={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "100px" }}>Department:</Typography>
              <FormControl size="small" sx={{ width: "400px" }}>
                <Select
                  value={selectedDepartmentFilter}
                  onChange={(e) => {
                    const selectedDept = e.target.value;
                    setSelectedDepartmentFilter(selectedDept);
                    handleDepartmentChange(selectedDept);
                  }}
                  displayEmpty
                >
                  {department.map((dep) => (
                    <MenuItem key={dep.dprtmnt_id} value={dep.dprtmnt_name}>
                      {dep.dprtmnt_name} ({dep.dprtmnt_code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "100px" }}>Program:</Typography>
              <FormControl size="small" sx={{ width: "350px" }}>
                <Select
                  value={selectedProgramFilter}
                  onChange={(e) => {
                    setSelectedProgramFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  disabled={isProgramLocked}
                  displayEmpty
                >
                  {!isProgramLocked && <MenuItem value="">All Programs</MenuItem>}
                  {curriculumOptions.map((prog) => (
                    <MenuItem key={prog.curriculum_id} value={prog.program_code}>
                      {prog.program_code} - {prog.program_description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>

        <Typography textAlign="left" color="maroon" sx={{ mb: 1, mt: 3, fontWeight: "bold" }}>
        Applicant Entrance Exam Filter
        </Typography>
        <Box display="flex" gap={2} mt={2} flexWrap="wrap">
          <Typography fontSize={13} sx={{ minWidth: "70px" }}>Total:</Typography>
          <TextField
            label="Total"
            size="small"
            type="number"
            value={minTotal}
            onChange={(e) => setMinTotal(e.target.value)}
          />
          <Typography fontSize={13} sx={{ minWidth: "70px" }}>Score:</Typography>
          <TextField
            label="Score %"
            size="small"
            type="number"
            value={minScorePercent}
            onChange={(e) => setMinScorePercent(e.target.value)}
          />
        </Box>
      </TableContainer>

      <div ref={divToPrintRef}></div>

      <TableContainer component={Paper} sx={{ width: "100%" }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
            <TableRow>
              <TableCell sx={{ color: "white", textAlign: "center", width: "2%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>#</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "8%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>Applicant ID</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "22%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>Name</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "15%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>Program</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "8%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>SHS GWA</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "8%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>Qualifying Exam Score</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "8%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>Qualifying Result</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "8%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>Interview Exam Score</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "8%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>Interview Result</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "8%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>Total Ave.</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "8%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>College Status</TableCell>
              <TableCell sx={{ color: "white", textAlign: "center", width: "8%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentPersons.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  sx={{ textAlign: "center", py: 3, fontStyle: "italic", color: "gray", border: `1px solid ${borderColor}` }}
                >
                  No Applicants available.
                </TableCell>
              </TableRow>
            ) : (
              currentPersons.map((p, index) => {
                const qualifyingExam = p.qualifying_exam_score ?? 0;
                const qualifyingInterview = p.qualifying_interview_score ?? 0;
                const computedTotalAve = (Number(qualifyingExam) + Number(qualifyingInterview)) / 2;

                const qualifyingStatusLabel =
                  p.qualifying_status === 0 ? "Passed" : p.qualifying_status === 1 ? "Failed" : "—";
                const interviewStatusLabel =
                  p.interview_status_result === 0
                    ? "Passed"
                    : p.interview_status_result === 1
                      ? "Failed"
                      : "—";

                const collegeStatusLabel =
                  Number(p.college_approval_status) === 1
                    ? "Accepted"
                    : Number(p.college_approval_status) === 2
                      ? "Rejected"
                      : "Waiting List";

                return (
                  <TableRow key={p.person_id} sx={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "lightgray" }}>
                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "12px" }}>
                      {index + 1}
                    </TableCell>

                    <TableCell
                      sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "12px", color: "blue", cursor: "pointer" }}
                      onClick={() => handleRowClick(p)}
                    >
                      {p.applicant_number ?? "N/A"}
                    </TableCell>

                    <TableCell
                      sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "12px", color: "blue", cursor: "pointer" }}
                      onClick={() => handleRowClick(p)}
                    >
                      {`${p.last_name}, ${p.first_name} ${p.middle_name ?? ""} ${p.extension ?? ""}`}
                    </TableCell>

                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "12px" }}>
                      {allCurriculums.find(
                        (item) => item.curriculum_id?.toString() === p.program?.toString(),
                      )?.program_code ?? "N/A"}
                    </TableCell>

                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "12px" }}>
                      {p.generalAverage1 || "0"}
                    </TableCell>

                    {/* READ-ONLY score / status display */}
                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "13px" }}>
                      {qualifyingExam}
                    </TableCell>
                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "13px" }}>
                      {qualifyingStatusLabel}
                    </TableCell>
                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "13px" }}>
                      {qualifyingInterview}
                    </TableCell>
                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "13px" }}>
                      {interviewStatusLabel}
                    </TableCell>
                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "13px" }}>
                      {computedTotalAve.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "13px", fontWeight: "bold" }}>
                      {collegeStatusLabel}
                    </TableCell>

                    <TableCell sx={{ border: `1px solid ${borderColor}`, textAlign: "center", fontSize: "12px" }}>
                      {(() => {
                        if (!p.created_at?.split("T")[0]) return "";
                        const date = new Date(p.created_at.split("T")[0]);
                        if (isNaN(date)) return p.created_at.split("T")[0];
                        return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TableContainer component={Paper} sx={{ width: "100%" }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "#6D2323", color: "white" }}>
            <TableRow>
              <TableCell
                colSpan={10}
                sx={{ border: `1px solid ${borderColor}`, py: 0.5, backgroundColor: settings?.header_color || "#1976d2", color: "white" }}
              >
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography fontSize="14px" fontWeight="bold" color="white">
                    Total Applicants: {filteredPersons.length}
                  </Typography>

                  <Box display="flex" alignItems="center" gap={1}>
                    <Button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80, color: "white", borderColor: "white", backgroundColor: "transparent",
                        "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
                        "&.Mui-disabled": { color: "white", borderColor: "white", backgroundColor: "transparent", opacity: 1 },
                      }}
                    >
                      First
                    </Button>

                    <Button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80, color: "white", borderColor: "white", backgroundColor: "transparent",
                        "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
                        "&.Mui-disabled": { color: "white", borderColor: "white", backgroundColor: "transparent", opacity: 1 },
                      }}
                    >
                      Prev
                    </Button>

                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={currentPage}
                        onChange={(e) => setCurrentPage(Number(e.target.value))}
                        displayEmpty
                        sx={{
                          fontSize: "12px", height: 36, color: "white", border: "1px solid white", backgroundColor: "transparent",
                          ".MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "white" },
                          "& svg": { color: "white" },
                        }}
                        MenuProps={{ PaperProps: { sx: { maxHeight: 200, backgroundColor: "#fff" } } }}
                      >
                        {Array.from({ length: totalPages }, (_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>Page {i + 1}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Typography fontSize="11px" color="white">
                      of {totalPages} page{totalPages > 1 ? "s" : ""}
                    </Typography>

                    <Button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80, color: "white", borderColor: "white", backgroundColor: "transparent",
                        "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
                        "&.Mui-disabled": { color: "white", borderColor: "white", backgroundColor: "transparent", opacity: 1 },
                      }}
                    >
                      Next
                    </Button>

                    <Button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80, color: "white", borderColor: "white", backgroundColor: "transparent",
                        "&:hover": { borderColor: "white", backgroundColor: "rgba(255,255,255,0.1)" },
                        "&.Mui-disabled": { color: "white", borderColor: "white", backgroundColor: "transparent", opacity: 1 },
                      }}
                    >
                      Last
                    </Button>
                  </Box>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
        </Table>
      </TableContainer>

      <Snackbar
        open={snack.open}
        onClose={handleSnackClose}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert onClose={handleSnackClose} severity={snack.severity} sx={{ width: "100%" }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default QualifyingExamScoreReadOnly;
