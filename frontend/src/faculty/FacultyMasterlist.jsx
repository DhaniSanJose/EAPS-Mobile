import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { SettingsContext } from "../App";
import "../styles/TempStyles.css";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Paper,
  FormControl,
  Select,
  InputLabel,
  MenuItem,
  Button,
  TextField,
} from "@mui/material";
import axios from "axios";
import API_BASE_URL from "../apiConfig";
import { useNavigate, useLocation } from "react-router-dom";
import { FcPrint } from "react-icons/fc";
import SearchIcon from "@mui/icons-material/Search";

const getStudentRegularStatus = (student) =>
  Number(student.is_regular ?? student.status);
const getStudentRegularLabel = (student) =>
  getStudentRegularStatus(student) === 1 ? "Regular" : "Irregular";

const StudentMasterlistRow = React.memo(function StudentMasterlistRow({
  student,
  rowNumber,
  borderColor,
  mainButtonColor,
  onNameClick,
}) {
  const uniqueRooms = useMemo(
    () => [
      ...new Set(
        (student.schedules || []).map((sch) => sch.room).filter(Boolean),
      ),
    ],
    [student.schedules],
  );

  return (
    <TableRow>
      <TableCell
        sx={{
          textAlign: "center",
          border: `1px solid ${borderColor}`,
        }}
      >
        {rowNumber}
      </TableCell>
      <TableCell
        sx={{
          textAlign: "center",
          border: `1px solid ${borderColor}`,
        }}
      >
        {student.student_number}
      </TableCell>
      <TableCell
        sx={{
          border: `1px solid ${borderColor}`,
          cursor: "pointer",
          transition: "all 0.2s ease",
          "&:hover": {
            color: mainButtonColor,
            textDecoration: "underline",
          },
        }}
        onClick={onNameClick}
      >
        {student.last_name}, {student.first_name} {student.middle_name}
      </TableCell>
      <TableCell
        sx={{
          textAlign: "center",
          border: `1px solid ${borderColor}`,
        }}
      >
        {student.program_code}-{student.section_description}
      </TableCell>
      <TableCell
        sx={{
          textAlign: "center",
          border: `1px solid ${borderColor}`,
        }}
      >
        {getStudentRegularLabel(student)}
      </TableCell>
      <TableCell
        sx={{
          textAlign: "center",
          border: `1px solid ${borderColor}`,
        }}
      >
        {uniqueRooms.map((room, i) => (
          <div key={i}>{room}</div>
        ))}
      </TableCell>
    </TableRow>
  );
});

const FacultyMasterList = () => {
  const navigate = useNavigate();
  const settings = useContext(SettingsContext);
  const location = useLocation();
  const { course_id, section_id, school_year_id, department_section_id } =
    location.state || {};
  const initialDepartmentSectionId = department_section_id || section_id;

  const [titleColor, setTitleColor] = useState("#000000");
  const [subtitleColor, setSubtitleColor] = useState("#555555");
  const [borderColor, setBorderColor] = useState("#000000");
  const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
  const [subButtonColor, setSubButtonColor] = useState("#ffffff"); // ✅ NEW
  const [stepperColor, setStepperColor] = useState("#000000"); // ✅ NEW

  const [fetchedLogo, setFetchedLogo] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [shortTerm, setShortTerm] = useState("");
  const [campusAddress, setCampusAddress] = useState("");

  useEffect(() => {
    if (!settings) return;

    // 🎨 Colors
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color)
      setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color); // ✅ NEW
    if (settings.stepper_color) setStepperColor(settings.stepper_color); // ✅ NEW

    // 🏫 Logo
    if (settings.logo_url) {
      setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    } else {
      setFetchedLogo(EaristLogo);
    }

    // 🏷️ School Information
    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);
  }, [settings]);

  const [userID, setUserID] = useState("");
  const [user, setUser] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [profData, setPerson] = useState({
    prof_id: "",
    employee_id: "",
    fname: "",
    mname: "",
    lname: "",
  });
  const [schoolYears, setSchoolYears] = useState([]);
  const [schoolSemester, setSchoolSemester] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
  const [selectedSchoolSemester, setSelectedSchoolSemester] = useState("");
  const [selectedActiveSchoolYear, setSelectedActiveSchoolYear] = useState("");
  const [classListAndDetails, setClassListAndDetails] = useState([]);
  const [courseAssignedTo, setCoursesAssignedTo] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [sectionAssignedTo, setSectionAssignedTo] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [masterlistBootstrapped, setMasterlistBootstrapped] = useState(false);
  const skipNextSectionFetchRef = useRef(false);
  const skipNextActiveYearResolveRef = useRef(false);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("Regular");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const itemsPerPage = 10;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const storedUser = localStorage.getItem("email");
    const storedRole = localStorage.getItem("role");
    const storedProfID = localStorage.getItem("prof_id");
    const storedEmployeeID = localStorage.getItem("employee_id");
    const storedID = storedProfID || storedEmployeeID;

    if (storedUser && storedRole && storedID) {
      setUser(storedUser);
      setUserRole(storedRole);
      setUserID(storedID);

      if (storedRole !== "faculty") {
        window.location.href = "/dashboard";
      } else {
        fetchPersonData(storedID);
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

  const fetchPersonData = async (id) => {
    try {
      const storedProfID = localStorage.getItem("prof_id");
      const storedEmployeeID = localStorage.getItem("employee_id");
      const endpoint = storedProfID
        ? `/api/get_prof_data_by_prof/${storedProfID}`
        : storedEmployeeID
          ? `/api/get_prof_data_by_employee/${storedEmployeeID}`
          : `/api/get_prof_data/${id}`;
      const res = await axios.get(`${API_BASE_URL}${endpoint}`);
      const first = res.data[0];
      localStorage.setItem("prof_id", first.prof_id || "");
      localStorage.setItem("employee_id", first.employee_id || "");

      const profInfo = {
        prof_id: first.prof_id,
        employee_id: first.employee_id,
        fname: first.fname,
        mname: first.mname,
        lname: first.lname,
      };

      setPerson(profInfo);
    } catch (err) {
      setLoading(false);
      setMessage("Error Fetching Professor Personal Data");
    }
  };

  useEffect(() => {
    if (profData.prof_id) {
      axios
        .get(`${API_BASE_URL}/api/faculty_masterlist_bootstrap/${profData.prof_id}`)
        .then((res) => {
          const data = res.data || {};
          const active = data.activeSchoolYear || {};
          const courses = Array.isArray(data.courses) ? data.courses : [];
          const sections = Array.isArray(data.sections) ? data.sections : [];

          setCoursesAssignedTo(courses);
          setSectionAssignedTo(sections);
          setClassListAndDetails(Array.isArray(data.classDetails) ? data.classDetails : []);

          if (!school_year_id && active.year_id) setSelectedSchoolYear(active.year_id);
          if (active.semester_id) setSelectedSchoolSemester(active.semester_id);
          if (active.school_year_id) setSelectedActiveSchoolYear(active.school_year_id);

          if (!course_id && courses.length > 0) {
            setSelectedCourse(courses[0].course_id);
          }

          if (!initialDepartmentSectionId && sections.length > 0) {
            setSelectedSection(sections[0].department_section_id);
          }

          skipNextSectionFetchRef.current = true;
          skipNextActiveYearResolveRef.current = true;
          setMasterlistBootstrapped(true);
        })
        .catch((err) => {
          console.error(err);
          setMasterlistBootstrapped(true);
        });
    }
  }, [profData.prof_id, course_id, initialDepartmentSectionId, school_year_id]);

  const filteredCourses = useMemo(
    () =>
      courseAssignedTo.filter((course) => {
        if (!selectedSchoolYear && !selectedSchoolSemester) return true;

        const matchesYear =
          !selectedSchoolYear ||
          String(course.year_id) === String(selectedSchoolYear);

        const matchesSemester =
          !selectedSchoolSemester ||
          String(course.semester_id) === String(selectedSchoolSemester);

        return matchesYear && matchesSemester;
      }),
    [courseAssignedTo, selectedSchoolYear, selectedSchoolSemester],
  );

  useEffect(() => {
    if (course_id) setSelectedCourse(course_id);
    if (initialDepartmentSectionId) setSelectedSection(initialDepartmentSectionId);
    if (school_year_id) setSelectedSchoolYear(school_year_id);
  }, [course_id, initialDepartmentSectionId, school_year_id]);

  useEffect(() => {
    if (!masterlistBootstrapped) return;
    if (skipNextSectionFetchRef.current) {
      skipNextSectionFetchRef.current = false;
      return;
    }
    if (
      !profData.prof_id ||
      !selectedCourse ||
      !selectedSchoolYear ||
      !selectedSchoolSemester
    )
      return;
    axios
      .get(
        `${API_BASE_URL}/api/section_assigned_to/${profData.prof_id}/${selectedCourse}/${selectedSchoolYear}/${selectedSchoolSemester}`,
      )
      .then((res) => {
        setSectionAssignedTo(res.data);

        if (res.data.length > 0) {
          setSelectedSection(res.data[0].department_section_id);
        } else {
          setSelectedSection("");
        }
      })
      .catch((err) => console.error(err));
  }, [masterlistBootstrapped, profData.prof_id, selectedCourse, selectedSchoolYear, selectedSchoolSemester]);

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    Promise.all([
      axios.get(`${API_BASE_URL}/api/get_school_year`),
      axios.get(`${API_BASE_URL}/api/get_school_semester/`),
    ])
      .then(([yearRes, semRes]) => {
        setSchoolYears(
          yearRes.data.filter(
            (yearObj) => Number(yearObj.current_year) <= currentYear,
          ),
        );
        setSchoolSemester(semRes.data);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!selectedSchoolYear || !selectedSchoolSemester) return;
    if (skipNextActiveYearResolveRef.current) {
      skipNextActiveYearResolveRef.current = false;
      return;
    }
    axios
      .get(
        `${API_BASE_URL}/api/get_selecterd_year/${selectedSchoolYear}/${selectedSchoolSemester}`,
      )
      .then((res) => {
        if (res.data.length > 0) {
          setSelectedActiveSchoolYear(res.data[0].school_year_id);
        }
      })
      .catch((err) => console.error(err));
  }, [selectedSchoolYear, selectedSchoolSemester]);

  const handleSchoolYearChange = (event) => {
    setSelectedSchoolYear(event.target.value);
  };

  const handleSchoolSemesterChange = (event) => {
    setSelectedSchoolSemester(event.target.value);
  };

  const handleSelectCourseChange = (event) => {
    setSelectedCourse(event.target.value);
  };

  const handleSelectSectionChange = (event) => {
    setSelectedSection(event.target.value);
  };

  const findPastClass = async () => {
    try {
      if (!profData.prof_id || !selectedSchoolYear || !selectedSchoolSemester) {
        setMessage("Please select School Year and Semester first.");
        return;
      }

      // 1️⃣ Fetch courses assigned to the professor
      const courseRes = await axios.get(
        `${API_BASE_URL}/api/course_assigned_to/${profData.prof_id}/${selectedSchoolYear}/${selectedSchoolSemester}`,
      );
      const courses = courseRes.data;
      setCoursesAssignedTo(courses);

      if (courses.length === 0) {
        setSectionAssignedTo([]);
        setSelectedCourse("");
        setSelectedSection("");
        setMessage("No courses found for this period.");
        return;
      }

      // 2️⃣ Choose first course if none selected
      const selectedCourseExists = courses.some(
        (course) => String(course.course_id) === String(selectedCourse),
      );
      const courseId = selectedCourseExists ? selectedCourse : courses[0].course_id;
      setSelectedCourse(courseId);

      // 3️⃣ Fetch sections for the selected course
      const sectionRes = await axios.get(
        `${API_BASE_URL}/api/handle_section_of/${profData.prof_id}/${courseId}/${selectedActiveSchoolYear}`,
      );

      const sections = sectionRes.data;
      setSectionAssignedTo(sections);
      if (sections.length > 0) {
        const selectedSectionExists = sections.some(
          (section) =>
            String(section.department_section_id) === String(selectedSection),
        );
        setSelectedSection(
          selectedSectionExists
            ? selectedSection
            : sections[0].department_section_id,
        );
      } else {
        setSelectedSection("");
      }

      if (sections.length === 0) {
        setSectionAssignedTo([]);
        setSelectedSection("");
        setMessage("No sections found for this course.");
        return;
      }

      // 4️⃣ Choose first section if none selected
      const sectionId = sections.some(
        (section) =>
          String(section.department_section_id) === String(selectedSection),
      )
        ? selectedSection
        : sections[0].department_section_id;
      setSelectedSection(sectionId);

      // 5️⃣ Fetch students for this section
      const detailsRes = await axios.get(`${API_BASE_URL}/api/get_class_details/${profData.prof_id}`);
      setClassListAndDetails(detailsRes.data);
      setMessage("");
    } catch (err) {
      console.error("Error fetching past class data:", err);
      setMessage("Failed to fetch data.");
    }
  };

  const filteredStudents = useMemo(() => {
    const q = debouncedSearch.toLowerCase();

    return classListAndDetails
      .filter((s) => {
        const matchesSearch =
          q === "" ||
          s.student_number?.toString().includes(q) ||
          s.first_name?.toLowerCase().includes(q) ||
          s.middle_name?.toLowerCase().includes(q) ||
          s.last_name?.toLowerCase().includes(q) ||
          `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
          `${s.last_name} ${s.first_name}`.toLowerCase().includes(q);

        const matchesYear =
          selectedSchoolYear === "" ||
          String(s.year_id) === String(selectedSchoolYear);

        const matchesSemester =
          selectedSchoolSemester === "" ||
          String(s.semester_id) === String(selectedSchoolSemester);

        const matchesCourse =
          selectedCourse === "" ||
          String(s.course_id) === String(selectedCourse);

        const matchesSection =
          selectedSection === "" ||
          String(s.department_section_id) === String(selectedSection);

        const matchesStatus =
          selectedStatusFilter === "" ||
          (selectedStatusFilter === "Regular" &&
            getStudentRegularStatus(s) === 1) ||
          (selectedStatusFilter === "Irregular" &&
            getStudentRegularStatus(s) !== 1);

        return (
          matchesSearch &&
          matchesYear &&
          matchesSemester &&
          matchesCourse &&
          matchesSection &&
          matchesStatus
        );
      })
      .sort((a, b) => {
        const nameA = `${a.last_name} ${a.first_name}`.toLowerCase();
        const nameB = `${b.last_name} ${b.first_name}`.toLowerCase();

        return sortOrder === "asc"
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      });
  }, [
    classListAndDetails,
    debouncedSearch,
    selectedSchoolYear,
    selectedSchoolSemester,
    selectedCourse,
    selectedSection,
    selectedStatusFilter,
    sortOrder,
  ]);

  const groupedList = useMemo(() => {
    const grouped = filteredStudents.reduce((acc, student) => {
      const key = student.student_number;

      if (!acc[key]) {
        acc[key] = {
          ...student,
          schedules: [],
        };
      }

      acc[key].schedules.push({
        day: student.day,
        start: student.school_time_start,
        end: student.school_time_end,
        room: student.room_description,
      });

      return acc;
    }, {});

    return Object.values(grouped);
  }, [filteredStudents]);

  const totalPages = Math.max(1, Math.ceil(groupedList.length / itemsPerPage));

  const paginatedGroupedList = useMemo(
    () =>
      groupedList.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      ),
    [groupedList, currentPage, itemsPerPage],
  );

  const selectedSchoolYearValue = useMemo(
    () =>
      schoolYears.some(
        (yearObj) => String(yearObj.year_id) === String(selectedSchoolYear),
      )
        ? selectedSchoolYear
        : "",
    [schoolYears, selectedSchoolYear],
  );

  const selectedSchoolSemesterValue = useMemo(
    () =>
      schoolSemester.some(
        (sem) => String(sem.semester_id) === String(selectedSchoolSemester),
      )
        ? selectedSchoolSemester
        : "",
    [schoolSemester, selectedSchoolSemester],
  );

  const selectedCourseValue = useMemo(
    () =>
      filteredCourses.some(
        (course) => String(course.course_id) === String(selectedCourse),
      )
        ? selectedCourse
        : "",
    [filteredCourses, selectedCourse],
  );

  const selectedSectionValue = useMemo(
    () =>
      sectionAssignedTo.some(
        (section) =>
          String(section.department_section_id) === String(selectedSection),
      )
        ? selectedSection
        : "",
    [sectionAssignedTo, selectedSection],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearch,
    selectedSchoolYear,
    selectedSchoolSemester,
    selectedCourse,
    selectedSection,
    selectedStatusFilter,
    sortOrder,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handleNavigateToGradingSheet = useCallback(() => {
    navigate("/grading_sheet", {
      state: {
        course_id: selectedCourse,
        section_id: selectedSection,
        school_year_id: selectedSchoolYear,
        departmentSection: department_section_id,
      },
    });
  }, [
    navigate,
    selectedCourse,
    selectedSection,
    selectedSchoolYear,
    department_section_id,
  ]);

  const divToPrintRef = useRef();

  const printDiv = () => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();

    doc.write(`
      <html>
        <head>
          <title>Print</title>
          <style>
            body {
              font-family: Arial;
              margin: 0.5in; /* 0.5 inch margins */
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 13px;
            }
            th, td {
              border: 1px solid black;
              padding: 6px;
              text-align: left;
            }
            th {
              background-color: #f0f0f0;
            }
            h2, h3, h4 {
              text-align: center;
              margin: 0;
            }
            h3 {
              margin-top: 20px;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            @media print {
              @page { margin: 0.5in; size: auto; }
            }
          </style>
        </head>
        <body>
          ${divToPrintRef.current.innerHTML}
        </body>
      </html>
    `);

    doc.close();
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    document.body.removeChild(iframe);
  };

  // 🔒 Disable right-click
  document.addEventListener("contextmenu", (e) => e.preventDefault());

  // 🔒 Block DevTools shortcuts + Ctrl+P silently
  document.addEventListener("keydown", (e) => {
    const isBlockedKey =
      e.key === "F12" || // DevTools
      e.key === "F11" || // Fullscreen
      (e.ctrlKey &&
        e.shiftKey &&
        (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) || // Ctrl+Shift+I/J
      (e.ctrlKey && e.key.toLowerCase() === "u") || // Ctrl+U (View Source)
      (e.ctrlKey && e.key.toLowerCase() === "p"); // Ctrl+P (Print)

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
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
          width: "100%",
        }}
      >
        {/* LEFT SIDE — TITLE */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: "bold",
            color: titleColor,
            fontSize: "36px",
          }}
        >
          CLASS LIST
        </Typography>

        {/* RIGHT SIDE — SEARCH + PRINT */}
        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Search Student Number / Student Name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              width: 450, // MATCHED WITH GRADING SHEET
              backgroundColor: "#fff",
              borderRadius: 1,
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
              },
            }}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} />,
            }}
          />

          <button
            onClick={printDiv}
            style={{
              width: "308px", // MATCHED WITH GRADING SHEET
              padding: "10px 20px",
              border: "2px solid black",
              backgroundColor: "#f0f0f0",
              color: "black",
              borderRadius: "5px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "bold",
              marginRight: "30px",
              transition: "background-color 0.3s, transform 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#d3d3d3")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
            onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
            onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <FcPrint size={20} />
              Print Class List
            </span>
          </button>
        </Box>
      </Box>

      <hr style={{ border: "1px solid #ccc", width: "98%" }} />

      <br />

      <TableContainer component={Paper} sx={{ width: "98%" }}>
        <Table size="small">
          <TableHead sx={{ backgroundColor: "#6D2323", color: "white" }}>
            <TableRow>
              <TableCell
                colSpan={10}
                sx={{
                  border: `1px solid ${borderColor}`,
                  py: 0.5,
                  backgroundColor: settings?.header_color || "#1976d2",
                  color: "white",
                }}
              >
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  {/* Left: Total Count */}
                  <Typography fontSize="14px" fontWeight="bold" color="white">
                    Total Students: {groupedList.length}
                  </Typography>

                  {/* Right: Pagination Controls */}
                  <Box display="flex" alignItems="center" gap={1}>
                    {/* First & Prev */}
                    <Button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
                      }}
                    >
                      First
                    </Button>

                    <Button
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(prev - 1, 1))
                      }
                      disabled={currentPage === 1}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
                      }}
                    >
                      Prev
                    </Button>

                    {/* Page Dropdown */}
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={currentPage <= totalPages ? currentPage : 1}
                        onChange={(e) => setCurrentPage(Number(e.target.value))}
                        displayEmpty
                        sx={{
                          fontSize: "12px",
                          height: 36,
                          color: "white",
                          border: "1px solid white",
                          backgroundColor: "transparent",
                          ".MuiOutlinedInput-notchedOutline": {
                            borderColor: "white",
                          },
                          "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: "white",
                          },
                          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: "white",
                          },
                          "& svg": {
                            color: "white", // dropdown arrow icon color
                          },
                        }}
                        MenuProps={{
                          PaperProps: {
                            sx: {
                              maxHeight: 200,
                              backgroundColor: "#fff", // dropdown background
                            },
                          },
                        }}
                      >
                        {Array.from({ length: totalPages }, (_, i) => (
                          <MenuItem key={i + 1} value={i + 1}>
                            Page {i + 1}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Typography fontSize="11px" color="white">
                      {totalPages} page{totalPages > 1 ? "s" : ""}
                    </Typography>

                    <Button
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                      }
                      disabled={currentPage === totalPages}
                      variant="outlined"
                      size="small"
                      sx={{
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
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
                        minWidth: 80,
                        color: "white",
                        borderColor: "white",
                        backgroundColor: "transparent",
                        "&:hover": {
                          borderColor: "white",
                          backgroundColor: "rgba(255,255,255,0.1)",
                        },
                        "&.Mui-disabled": {
                          color: "white",
                          borderColor: "white",
                          backgroundColor: "transparent",
                          opacity: 1,
                        },
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
      <TableContainer
        component={Paper}
        sx={{ width: "98%", border: `1px solid ${borderColor}`, p: 2 }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            margin: "1rem 0",
            padding: "0 1rem",
          }}
        >
          {/* LEFT SIDE: Course, Section, Student Status + Sort */}
          <Box display="flex" flexDirection="column" gap={2}>

            {/* Course */}
            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "110px" }}>
                Course:
              </Typography>
              <FormControl sx={{ width: "550px" }}>
                <InputLabel id="demo-simple-select-label">Course</InputLabel>
                <Select
                  labelId="demo-simple-select-label"
                  id="demo-simple-select"
                  value={selectedCourseValue}
                  label="Course"
                  onChange={handleSelectCourseChange}
                >
                  {!courseAssignedTo || courseAssignedTo.length === 0 ? (
                    <MenuItem disabled>No Course Assigned this Academic Year</MenuItem>
                  ) : filteredCourses.length > 0 ? (
                    filteredCourses.map((course) => (
                      <MenuItem key={course.course_id} value={course.course_id}>
                        {course.course_code} - {course.course_description}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>No Course Assigned this Academic Year</MenuItem>
                  )}
                </Select>
              </FormControl>
            </Box>

            {/* Section */}
            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "110px" }}>
                Section:
              </Typography>
              <FormControl sx={{ width: "550px" }}>
                <InputLabel id="section-select-label">Section</InputLabel>
                <Select
                  labelId="section-select-label"
                  id="section-select"
                  label="Section"
                  value={selectedSectionValue}
                  onChange={(e) => setSelectedSection(e.target.value)}
                >
                  {!selectedCourse ? (
                    <MenuItem disabled>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                        Please select a course first
                      </Typography>
                    </MenuItem>
                  ) : sectionAssignedTo.length > 0 ? (
                    sectionAssignedTo.map((section) => (
                      <MenuItem key={section.department_section_id} value={section.department_section_id}>
                        {section.program_code}-{section.section_description}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                        No sections available for this course
                      </Typography>
                    </MenuItem>
                  )}
                </Select>
              </FormControl>
            </Box>

            {/* Student Status + Sort beside it */}
            <Box display="flex" alignItems="center" gap={2}>
              <Typography fontSize={13} sx={{ minWidth: "110px" }}>
                Student Status:
              </Typography>
              <FormControl sx={{ width: "150px" }}>
                <Select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Regular">Regular</MenuItem>
                  <MenuItem value="Irregular">Irregular</MenuItem>
                </Select>
              </FormControl>

              <Typography fontSize={13}>Sort:</Typography>
              <FormControl sx={{ width: "120px" }}>
                <InputLabel id="sort-label">Sort</InputLabel>
                <Select
                  labelId="sort-label"
                  label="Sort"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                >
                  <MenuItem value="asc">A – Z</MenuItem>
                  <MenuItem value="desc">Z – A</MenuItem>
                </Select>
              </FormControl>
            </Box>

          </Box>

          {/* RIGHT SIDE: School Year, Semester, Find Last Grade */}
          <Box display="flex" flexDirection="column" gap={2} alignItems="flex-end">

            {/* School Year */}
            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "100px" }} textAlign="right">
                School Year:
              </Typography>
              <FormControl sx={{ width: "180px" }}>
                <InputLabel id="school-year-label">School Year</InputLabel>
                <Select
                  labelId="school-year-label"
                  label="School Year"
                  value={selectedSchoolYearValue}
                  onChange={(e) => setSelectedSchoolYear(e.target.value)}
                >
                  <MenuItem value="" disabled>Select School Year</MenuItem>
                  {schoolYears.map((yearObj) => (
                    <MenuItem key={yearObj.year_id} value={yearObj.year_id}>
                      {yearObj.current_year} - {yearObj.next_year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Semester */}
            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "100px" }} textAlign="right">
                Semester:
              </Typography>
              <FormControl sx={{ width: "180px" }}>
                <InputLabel id="semester-label">Semester</InputLabel>
                <Select
                  labelId="semester-label"
                  label="Semester"
                  value={selectedSchoolSemesterValue}
                  onChange={(e) => setSelectedSchoolSemester(e.target.value)}
                >
                  <MenuItem value="" disabled>Select Semester</MenuItem>
                  {schoolSemester.map((sem) => (
                    <MenuItem key={sem.semester_id} value={sem.semester_id}>
                      {sem.semester_description}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Find Last Grade */}
            <Box display="flex" alignItems="center" gap={1}>
              <Typography fontSize={13} sx={{ minWidth: "100px" }} textAlign="right">
                Find Last Grade:
              </Typography>
              <FormControl sx={{ width: "150px" }}>
                <InputLabel id="find-grade-label">Action</InputLabel>
                <Select
                  labelId="find-grade-label"
                  label="Action"
                  value=""
                  onChange={(e) => {
                    if (e.target.value === "find") findPastClass();
                  }}
                  displayEmpty
                >
                  <MenuItem value="find">Run Search</MenuItem>
                </Select>
              </FormControl>
            </Box>

          </Box>
        </Box>
      </TableContainer>
      <TableContainer
        component={Paper}
        sx={{ width: "98%", marginTop: "2rem" }}
      >
        <Table size="small">
          <TableHead
            sx={{ backgroundColor: settings?.header_color || "#1976d2" }}
          >
            <TableRow>
              <TableCell
                sx={{
                  color: "white",
                  textAlign: "center",
                  fontSize: "12px",
                  border: `1px solid ${borderColor}`,
                }}
              >
                #
              </TableCell>
              <TableCell
                sx={{
                  color: "white",
                  textAlign: "center",
                  fontSize: "12px",
                  border: `1px solid ${borderColor}`,
                }}
              >
                Student Number
              </TableCell>
              <TableCell
                sx={{
                  color: "white",
                  textAlign: "center",
                  fontSize: "12px",
                  border: `1px solid ${borderColor}`,
                }}
              >
                Student Name
              </TableCell>
              <TableCell
                sx={{
                  color: "white",
                  textAlign: "center",
                  fontSize: "12px",
                  border: `1px solid ${borderColor}`,
                }}
              >
                Section
              </TableCell>
              <TableCell
                sx={{
                  color: "white",
                  textAlign: "center",
                  fontSize: "12px",
                  border: `1px solid ${borderColor}`,
                }}
              >
                Student Status
              </TableCell>
              <TableCell
                sx={{
                  color: "white",
                  textAlign: "center",
                  fontSize: "12px",
                  border: `1px solid ${borderColor}`,
                }}
              >
                Room
              </TableCell>
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
            {paginatedGroupedList.length > 0 ? (
              paginatedGroupedList.map((student, index) => (
                <StudentMasterlistRow
                  key={student.student_number}
                  student={student}
                  rowNumber={(currentPage - 1) * itemsPerPage + index + 1}
                  borderColor={borderColor}
                  mainButtonColor={mainButtonColor}
                  onNameClick={handleNavigateToGradingSheet}
                />
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  align="center"
                  sx={{ border: `1px solid ${borderColor}` }}
                >
                  No class details available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <div style={{ display: "none" }}>
        <div ref={divToPrintRef} style={{ margin: "0.5in" }}>
          <style>
            {`
              @media print {
                body {
                  margin: 0.5in;
                }
                table {
                  page-break-inside: auto;
                }
                tr {
                  page-break-inside: avoid;
                  page-break-after: auto;
                }
                  
              }
            `}
          </style>
          {/* Header Section */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "20px",
            }}
          >
            {/* Logo */}
            <div>
              <img
                src={fetchedLogo}
                alt="Logo"
                style={{
                  width: "80px",
                  height: "80px",
                  objectFit: "contain",
                  marginTop: "-10px",
                }}
              />
            </div>

            {/* School Info */}
            <div
              style={{
                textAlign: "center",
                flex: 1,
                marginLeft: "10px",
                marginRight: "10px",
              }}
            >
              <span style={{ margin: 0, fontFamily: "Arial", fontSize: "13px" }}>
                Republic of the Philippines
              </span>
              <h2
                style={{ margin: 0, fontSize: "20px", letterSpacing: "-1px" }}
              >
                {companyName}
              </h2>
              <span style={{ margin: 0, fontSize: "12px" }}>
                {campusAddress || "Nagtahan St. Sampaloc, Manila"}
              </span>
            </div>

            {/* Empty space or right-aligned info */}
            <div style={{ width: "80px" }}></div>
          </div>

          {/* Document Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              lineSpacing: "-1px",
            }}
          >
            <span style={{ fontSize: "20px" }}>
              <b>{groupedList[0]?.course_description.toUpperCase() || ""}</b>
            </span>
            <span style={{ fontSize: "15px" }}>
              {groupedList[0]?.dprtmnt_name || ""}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              lineSpacing: "-1px",
              marginTop: "2rem",
              marginBottom: "1rem",
            }}
          >
            <span style={{ fontSize: "20px" }}>
              <b>OFFICIAL LIST OF ENROLLED STUDENTS</b>
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "end",
                justifyContent: "center",
              }}
            >
              <span style={{ marginRight: "0.5rem", fontSize: "15px" }}>
                Academic Year
              </span>
              <span style={{ fontSize: "15px" }}>
                {groupedList[0]?.current_year || ""}-
                {groupedList[0]?.next_year || ""},&nbsp;&nbsp;
                {groupedList[0]?.semester_description || ""}
              </span>
            </div>
          </div>

          {/* School Info Table */}
          <table
            style={{
              borderCollapse: "collapse",
              fontSize: "12px",
              lineHeight: "1",
              padding: 0,
            }}
          >
            <thead>
              {/* spacer row to remove double borders */}
              <tr>
                <td
                  colSpan={1}
                  style={{
                    width: "80px",
                    borderRight: "none",
                    borderBottom: "none",
                  }}
                ></td>
                <td
                  colSpan={5}
                  style={{ borderRight: "none", borderBottom: "none" }}
                ></td>
                <td
                  colSpan={1}
                  style={{ borderLeft: "none", borderBottom: "none" }}
                ></td>
                <td
                  colSpan={2}
                  style={{ borderLeft: "none", borderBottom: "none" }}
                ></td>
              </tr>

              {/* Subject Code + Class Section */}
              <tr>
                <td
                  colSpan={1}
                  style={{
                    width: "80px",
                    borderTop: "none",
                    padding: "0px 2px",
                  }}
                >
                  Subject Code:
                </td>
                <td
                  colSpan={5}
                  style={{
                    borderRight: "none",
                    borderTop: "none",
                    padding: "0px 2px",
                  }}
                >
                  {groupedList[0]?.course_code || ""}
                </td>

                <td
                  colSpan={1}
                  style={{
                    borderLeft: "none",
                    borderTop: "none",
                    padding: "0px 2px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "end" }}>
                    Class Section:
                  </div>
                </td>

                <td
                  colSpan={2}
                  style={{ borderTop: "none", padding: "0px 2px" }}
                >
                  {groupedList[0]?.program_code || ""}-
                  {groupedList[0]?.section_description || ""}
                </td>
              </tr>

              {/* Subject Title + Year Level */}
              <tr>
                <td
                  colSpan={1}
                  style={{
                    width: "80px",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  Subject Title:
                </td>

                <td
                  colSpan={5}
                  style={{
                    borderRight: "none",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  {groupedList[0]?.course_description || ""}
                </td>

                <td
                  colSpan={1}
                  style={{
                    borderLeft: "none",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "end" }}>
                    Year Level:
                  </div>
                </td>

                <td
                  colSpan={2}
                  style={{
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  {groupedList[0]?.year_level_description || ""}
                </td>
              </tr>

              {/* Academic Units + Lab Units + Schedule */}
              <tr>
                <td
                  colSpan={1}
                  style={{
                    width: "80px",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  Academic Units:
                </td>

                <td
                  colSpan={1}
                  style={{
                    paddingRight: "2px",
                    textAlign: "center",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  {groupedList[0]?.course_unit || "0"}
                </td>

                <td
                  colSpan={1}
                  style={{
                    width: "80px",
                    borderLeft: "none",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  Lab Units:
                </td>

                <td
                  colSpan={1}
                  style={{
                    paddingRight: "2px",
                    textAlign: "center",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  {groupedList[0]?.lab_unit || "0"}
                </td>

                <td
                  colSpan={3}
                  style={{
                    borderLeft: "none",
                    borderTop: "none",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "end" }}>
                    Schedule:
                  </div>
                </td>
                <td
                  colSpan={2}
                  style={{
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    borderBottom: "none",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  {groupedList.length > 0 &&
                    groupedList[0].schedules.length > 0 ? (
                    <div>
                      {groupedList[0].schedules[0].day}{" "}
                      {groupedList[0].schedules[0].start} -{" "}
                      {groupedList[0].schedules[0].end}
                    </div>
                  ) : (
                    <div>TBA</div>
                  )}
                </td>
              </tr>

              {/* Credit Units + Lab Units */}
              <tr>
                <td
                  colSpan={1}
                  style={{
                    width: "80px",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  Credit Units:
                </td>

                <td
                  colSpan={1}
                  style={{
                    paddingRight: "2px",
                    textAlign: "center",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  {groupedList[0]?.course_unit || "0"}
                </td>

                <td
                  colSpan={1}
                  style={{
                    width: "80px",
                    borderLeft: "none",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  Lab Units:
                </td>

                <td
                  colSpan={1}
                  style={{
                    paddingRight: "2px",
                    textAlign: "center",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  {groupedList[0]?.lab_unit || "0"}
                </td>

                <td
                  colSpan={3}
                  style={{
                    borderLeft: "none",
                    borderTop: "none",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    paddingTop: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "end" }}></div>
                </td>
                <td
                  colSpan={2}
                  rowSpan={4}
                  style={{
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    borderTop: "none",
                    paddingTop: "6px",
                  }}
                ></td>
              </tr>

              {/* Mode */}
              <tr>
                <td
                  colSpan={1}
                  style={{
                    width: "80px",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    borderTop: "none",
                    paddingTop: "6px",
                  }}
                >
                  Mode:
                </td>
                <td
                  colSpan={6}
                  style={{
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    borderTop: "none",
                    paddingTop: "6px",
                  }}
                ></td>
              </tr>

              {/* Faculty */}
              <tr>
                <td
                  colSpan={1}
                  style={{
                    width: "80px",
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    borderTop: "none",
                    paddingTop: "6px",
                  }}
                >
                  Faculty:
                </td>
                <td
                  colSpan={6}
                  style={{
                    paddingRight: "2px",
                    paddingLeft: "2px",
                    paddingBottom: "1px",
                    borderTop: "none",
                    paddingTop: "6px",
                  }}
                >
                  {profData.fname} {profData.mname} {profData.lname}
                </td>
              </tr>
            </thead>
          </table>

          {/* Students Table */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
              marginTop: "0.5rem",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "6px 0px",
                    width: "30px",
                    textAlign: "center",
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "6px 0px",
                    width: "80px",
                    textAlign: "center",
                  }}
                >
                  Student No.
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "6px",
                    width: "280px",
                    textAlign: "start",
                  }}
                >
                  Student Name
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "6px 0px",
                    width: "50px",
                    textAlign: "center",
                  }}
                >
                  Age
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "6px 0px",
                    width: "50px",
                    textAlign: "center",
                  }}
                >
                  Sex
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "6px 0px",
                    width: "80px",
                    textAlign: "center",
                  }}
                >
                  Year Level
                </th>
                <th
                  style={{
                    border: "1px solid black",
                    padding: "6px 0px",
                    width: "80px",
                    textAlign: "center",
                  }}
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedList.length > 0 ? (
                groupedList.map((s, index) => (
                  <tr key={s.student_number}>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {index + 1}
                    </td>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {s.student_number}
                    </td>
                    <td
                      style={{ border: "1px solid black", padding: "6px" }}
                    >{`${s.last_name}, ${s.first_name} ${s.middle_name || ""}`}</td>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {s.age}
                    </td>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {s.gender === 0 ? "Male" : "Female"}
                    </td>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {s.year_level_description}
                    </td>
                    <td
                      style={{
                        border: "1px solid black",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {getStudentRegularLabel(s)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      border: "1px solid black",
                      padding: "6px",
                      textAlign: "center",
                    }}
                  >
                    No class details available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Box>
  );
};

export default FacultyMasterList;
