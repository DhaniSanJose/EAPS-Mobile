import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import axios from 'axios';
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
    TableCell,
    TextField,
    MenuItem,
    Card,
    InputLabel,
    TableBody,
} from '@mui/material';
import { Snackbar, Alert } from '@mui/material';
import { useNavigate, useLocation } from "react-router-dom";
import { FcPrint } from "react-icons/fc";
import EaristLogo from "../assets/EaristLogo.png";
import { Link } from "react-router-dom";
import SchoolIcon from "@mui/icons-material/School";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AssignmentIcon from "@mui/icons-material/Assignment";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import PeopleIcon from "@mui/icons-material/People";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import _ from "lodash";
import {
    isRegistrarCurriculumMatch,
    isRegistrarProgramSelectionLocked,
    restrictToRegistrarCurriculum,
    syncRegistrarScopeFromAdminData,
    getDepartmentIdsFromAdminData,
} from "../utils/registrarCurriculumRestriction";
import useRegistrarScopeRevision from "../hooks/useRegistrarScopeRevision";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay";
import SearchIcon from "@mui/icons-material/Search";
import KeyIcon from "@mui/icons-material/Key";
import API_BASE_URL from "../apiConfig";
import CampaignIcon from '@mui/icons-material/Campaign';
import ScoreIcon from '@mui/icons-material/Score';
import DateField from "../components/DateField";
import PersonIcon from "@mui/icons-material/Person";


const ApplicantScoringReadOnly = () => {


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
    const [branches, setBranches] = useState([]);

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

    const words = companyName.trim().split(" ");
    const middle = Math.ceil(words.length / 2);
    const firstLine = words.slice(0, middle).join(" ");
    const secondLine = words.slice(middle).join(" ");

    const location = useLocation();

    const handleRowClick = (applicant) => {
        const personId = applicant?.person_id;
        if (!personId) return;

        const searchValue =
            applicant?.applicant_number ||
            `${applicant?.last_name ?? ""}, ${applicant?.first_name ?? ""}`.trim();

        sessionStorage.setItem("admin_edit_person_id", String(personId));
        sessionStorage.setItem("edit_person_id", String(personId));
        sessionStorage.setItem("admin_edit_person_id_source", "applicant_list_college");
        sessionStorage.setItem("admin_edit_person_id_ts", String(Date.now()));
        sessionStorage.setItem("admin_edit_person_data", JSON.stringify(applicant));

        if (searchValue) {
            sessionStorage.setItem("admin_edit_search_query", String(searchValue));
            sessionStorage.setItem("edit_applicant_number", String(searchValue));
        }

        navigate(`/admin_dashboard1?person_id=${personId}`);
    };

    const tabs = [
       {
            label: "Applicant List",
            to: "/applicant_list_college",
            icon: <SchoolIcon fontSize="large" />,
          },
          {
            label: "Applicant Profile",
            to: "/applicant_college_personal_information",
            icon: <PersonIcon fontSize="large" />,
          },
          {
            label: "Applicant Online Requirements",
            to: "/applicant_online_requirements_college",
            icon: <AssignmentIcon fontSize="large" />,
          },
          {
            label: "Entrance Examination Score",
            to: "/college_entrance_examination_score",
            icon: <ScoreIcon fontSize="large" />,
          },
          {
            label: "Qualifying / Interview Schedule Management",
            to: "/college_qualifying_interview_schedule_management",
            icon: <ScheduleIcon fontSize="large" />,
          },
          {
            label: "Qualifying / Interview Exam Score",
            to: "/college_qualifying_interview_score",
            icon: <ScoreIcon fontSize="large" />,
          },
        
    ];

    const [hasAccess, setHasAccess] = useState(null);
    const [loading, setLoading] = useState(false);

    const pageId = 151;

    const [employeeID, setEmployeeID] = useState("");

    const auditActor = () => ({
        audit_actor_id:
            employeeID ||
            localStorage.getItem("employee_id") ||
            localStorage.getItem("email") ||
            "unknown",
        audit_actor_role: userRole || localStorage.getItem("role") || "registrar",
    });

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
            const response = await axios.get(`${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`);
            if (response.data && response.data.page_privilege === 1) {
                setHasAccess(true);
            } else {
                setHasAccess(false);
            }
        } catch (error) {
            console.error('Error checking access:', error);
            setHasAccess(false);
            if (error.response && error.response.data.message) {
                console.log(error.response.data.message);
            } else {
                console.log("An unexpected error occurred.");
            }
            setLoading(false);
        }
    };



    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(3);
    const [clickedSteps, setClickedSteps] = useState(Array(tabs.length).fill(false));



    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const personIdFromUrl = queryParams.get("person_id");

        if (!personIdFromUrl) return;

        axios
            .get(`${API_BASE_URL}/api/person_with_applicant/${personIdFromUrl}`)
            .then((res) => {
                if (res.data?.applicant_number) {

                    setSearchQuery(res.data.applicant_number);

                    if (typeof fetchUploadsByApplicantNumber === "function") {
                        fetchUploadsByApplicantNumber(res.data.applicant_number);
                    }

                    if (typeof fetchApplicants === "function") {
                        fetchApplicants();
                    }
                }
            })
            .catch((err) => console.error("Auto search failed:", err));
    }, [location.search]);


    useEffect(() => {
        if (location.search.includes("person_id")) {
            navigate("/college_entrance_examination_score", { replace: true });
        }
    }, [location, navigate]);

    const handleStepClick = (index, to) => {
        setActiveStep(index);

        const pid = sessionStorage.getItem("admin_edit_person_id");
        if (pid) {
            navigate(`${to}?person_id=${pid}`);
        } else {
            navigate(to);
        }
    };




    const [persons, setPersons] = useState([]);

    const [selectedPerson, setSelectedPerson] = useState(null);
    const [assignedNumber, setAssignedNumber] = useState('');
    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");
    const [adminData, setAdminData] = useState({ dprtmnt_id: "", dprtmnt_ids: [] });

    const queryParams = new URLSearchParams(location.search);
    const queryPersonId = queryParams.get("person_id")?.trim() || "";

    useEffect(() => {
        const storedUser = localStorage.getItem("email");
        const storedRole = localStorage.getItem("role");
        const loggedInPersonId = localStorage.getItem("person_id");

        if (!storedUser || !storedRole || !loggedInPersonId) {
            window.location.href = "/login";
            return;
        }

        setUser(storedUser);
        setUserRole(storedRole);

        const allowedRoles = ["registrar", "applicant", "superadmin"];
        if (!allowedRoles.includes(storedRole)) {
            window.location.href = "/login";
            return;
        }

        const lastSelected = sessionStorage.getItem("admin_edit_person_id");

        if (queryPersonId !== "") {
            sessionStorage.setItem("admin_edit_person_id", queryPersonId);
            setUserID(queryPersonId);
            return;
        }

        setUserID("");
    }, [queryPersonId]);

    useEffect(() => {
        const storedUser = localStorage.getItem("email");
        const storedRole = localStorage.getItem("role");
        const loggedInPersonId = localStorage.getItem("person_id");
        const searchedPersonId = sessionStorage.getItem("admin_edit_person_id");

        if (!storedUser || !storedRole || !loggedInPersonId) {
            window.location.href = "/login";
            return;
        }

        setUser(storedUser);
        setUserRole(storedRole);

        const allowedRoles = ["registrar", "applicant", "superadmin"];
        if (allowedRoles.includes(storedRole)) {
            const targetId = queryPersonId || searchedPersonId || loggedInPersonId;
            sessionStorage.setItem("admin_edit_person_id", targetId);
            setUserID(targetId);
            return;
        }

        window.location.href = "/login";
    }, [queryPersonId]);

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
        if (user) {
            fetchPersonData();
        }
    }, [user]);


    const [error, setError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [snack, setSnack] = useState({ open: false, message: '', severity: 'info' });
    const [person, setPerson] = useState({
        campus: "",
        last_name: "",
        first_name: "",
        middle_name: "",
        document_status: "",
        extension: "",
        generalAverage1: "",
        program: "",
        created_at: "",
        middle_code: "",
        generalAverage1: "", 
    });

    useEffect(() => {
        if (!settings) return;

        const branchId = person?.campus;
        const matchedBranch = branches.find(
            (branch) => String(branch?.id) === String(branchId)
        );

        if (matchedBranch?.address) {
            setCampusAddress(matchedBranch.address);
            return;
        }

        if (settings.campus_address) {
            setCampusAddress(settings.campus_address);
            return;
        }

        setCampusAddress(settings.address || "");
    }, [settings, branches, person?.campus]);
    const [allApplicants, setAllApplicants] = useState([]);

    const fetchApplicants = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/api-applicant-scoring`);

            const { data, subjects } = res.data;

            setSubjects(subjects);

            const uniqueData = Object.values(
                data.reduce((acc, curr) => {
                    acc[curr.applicant_number] = curr;
                    return acc;
                }, {})
            );

            setPersons(uniqueData);

        } catch (err) {
            console.error("❌ Error fetching applicants with scores:", err);
        }
    };


    useEffect(() => {
        fetchApplicants();
    }, []);

    const [subjects, setSubjects] = useState([]);

    const fetchSubjects = async () => {
        try {
            const res = await axios.get(
                `${API_BASE_URL}/api/subjects`
            );

            setSubjects(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchSubjects();
    }, []);



    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (searchQuery.trim() === "") return;

            try {
                const res = await axios.get(`${API_BASE_URL}/api/search-person`, {
                    params: { query: searchQuery }
                });

                if (res.data && res.data.person_id) {
                    const details = await axios.get(`${API_BASE_URL}/api/person_with_applicant/${res.data.person_id}`);
                    setPerson(details.data);

                    sessionStorage.setItem("admin_edit_person_id", details.data.person_id);
                    setUserID(details.data.person_id);
                    setSearchError("");
                } else {
                    console.error("No valid person ID found in search result");
                    setSearchError("Invalid search result");
                }
            } catch (err) {
                console.error("Search failed:", err);
                setSearchError("Applicant not found");
            }
        }, 500);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery]);


    const [curriculumOptions, setCurriculumOptions] = useState([]);


 

    const [selectedApplicantStatus, setSelectedApplicantStatus] = useState("");
    const [sortBy, setSortBy] = useState("name");
    const [sortOrder, setSortOrder] = useState("asc");

    const [selectedRegistrarStatus, setSelectedRegistrarStatus] = useState("");

    const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState("");
    const [selectedProgramFilter, setSelectedProgramFilter] = useState("");
    const isProgramLocked = isRegistrarProgramSelectionLocked();
    const scopeRevision = useRegistrarScopeRevision();
    const [department, setDepartment] = useState([]);
    const [allCurriculums, setAllCurriculums] = useState([]);
    const selectedDepartmentFilterValue =
        selectedDepartmentFilter === "" ||
            department.some(
                (dep) => String(dep.dprtmnt_name) === String(selectedDepartmentFilter)
            )
            ? selectedDepartmentFilter
            : "";
    const selectedProgramFilterValue =
        selectedProgramFilter === "" ||
            curriculumOptions.some(
                (prog) => String(prog.program_code) === String(selectedProgramFilter)
            )
            ? selectedProgramFilter
            : "";

    useEffect(() => {
        if (!isProgramLocked) return;
        const assignedCurriculum = curriculumOptions.find((prog) =>
            isRegistrarCurriculumMatch(prog.curriculum_id)
        );
        if (assignedCurriculum?.program_code) {
            setSelectedProgramFilter(assignedCurriculum.program_code);
        }
    }, [curriculumOptions, isProgramLocked]);



    const [schoolYears, setSchoolYears] = useState([]);
    const [semesters, setSchoolSemester] = useState([]);
    const [selectedSchoolYear, setSelectedSchoolYear] = useState("");
    const [selectedSchoolSemester, setSelectedSchoolSemester] = useState('');
    const [selectedActiveSchoolYear, setSelectedActiveSchoolYear] = useState('');

    useEffect(() => {
        axios
            .get(`${API_BASE_URL}/api/get_school_year/`)
            .then((res) => setSchoolYears(res.data))
            .catch((err) => console.error(err));
    }, [])

    useEffect(() => {
        axios
            .get(`${API_BASE_URL}/api/get_school_semester/`)
            .then((res) => setSchoolSemester(res.data))
            .catch((err) => console.error(err));
    }, [])

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

    const handleSchoolYearChange = (event) => {
        setSelectedSchoolYear(event.target.value);
    };

    const handleSchoolSemesterChange = (event) => {
        setSelectedSchoolSemester(event.target.value);
    };

    const normalize = (s) => (s ?? "").toString().trim().toLowerCase();
    const selectedSemester = semesters.find(
        (sem) => String(sem.semester_id) === String(selectedSchoolSemester)
    );
    const parseDateOnlyLocal = (value) => {
        if (!value) return null;
        const datePart = String(value).split("T")[0];
        const [y, m, d] = datePart.split("-").map(Number);
        if (!y || !m || !d) return null;
        return new Date(y, m - 1, d);
    };
    const [showSubmittedOnly, setShowSubmittedOnly] = useState(false);

    const [minTotal, setMinTotal] = useState("");
    const [minScorePercent, setMinScorePercent] = useState("");
    const [minFinalRating, setMinFinalRating] = useState("");


    const filteredPersons = persons
        .filter((personData) => {

            const fullText = `${personData.first_name} ${personData.middle_name} ${personData.last_name} ${personData.emailAddress ?? ''} ${personData.applicant_number ?? ''}`.toLowerCase();
            const matchesSearch = fullText.includes(searchQuery.toLowerCase());

            const matchesCampus =
                !person.campus || String(personData.campus) === String(person.campus);

            const matchesApplicantStatus =
                selectedApplicantStatus === "" ||
                normalize(personData.document_status) === normalize(selectedApplicantStatus);

            const matchesRegistrarStatus =
                selectedRegistrarStatus === "" ||
                (selectedRegistrarStatus === "Submitted" && personData.registrar_status === 1) ||
                (selectedRegistrarStatus === "Unsubmitted / Incomplete" && personData.registrar_status === 0);

            const programInfo = allCurriculums.find(
                (opt) => opt.curriculum_id?.toString() === personData.program?.toString()
            );
            const matchesRegistrarCurriculum = isRegistrarCurriculumMatch(
                personData.program
            );

            const matchesDepartment =
                selectedDepartmentFilter === "" ||
                programInfo?.dprtmnt_name === selectedDepartmentFilter;

            const matchesProgram =
                selectedProgramFilter === "" ||
                programInfo?.program_code === selectedProgramFilter;

            const appliedDate = parseDateOnlyLocal(personData.created_at);
            if (!appliedDate) return true;

            const applicantAppliedYear = appliedDate.getFullYear();

            const schoolYear = schoolYears.find((sy) => sy.year_id === selectedSchoolYear);

            const matchesSchoolYear =
                selectedSchoolYear === "" ||
                (schoolYear && String(applicantAppliedYear) === String(schoolYear.current_year));

            const matchesSemester =
                selectedSchoolSemester === "" ||
                normalize(personData.middle_code) === normalize(selectedSemester?.semester_code);

            let matchesDateRange = true;

            let from = parseDateOnlyLocal(person.fromDate);
            let to = parseDateOnlyLocal(person.toDate);
            if (to) to.setHours(23, 59, 59, 999);

            if (from && to && from > to) {
                const swappedFrom = parseDateOnlyLocal(person.toDate);
                const swappedTo = parseDateOnlyLocal(person.fromDate);
                if (swappedTo) swappedTo.setHours(23, 59, 59, 999);
                from = swappedFrom;
                to = swappedTo;
            }

            if (from && appliedDate < from) matchesDateRange = false;
            if (to && appliedDate > to) matchesDateRange = false;

            const matchesSubmittedDocs =
                !showSubmittedOnly || personData.submitted_documents === 1;

            const subjectScores = subjects.map((subject) =>
                Number(personData.scores?.[subject.id] ?? 0)
            );

            const total = subjectScores.reduce((sum, score) => sum + score, 0);

            const maxTotal = subjects.reduce(
                (sum, subject) => sum + Number(subject.max_score || 0),
                0
            );

            const scorePercent =
                maxTotal > 0 ? (total / maxTotal) * 100 : 0;

            const finalRating =
                subjectScores.length > 0
                    ? Math.round(total / subjectScores.length)
                    : 0;

            const matchesTotal =
                minTotal === "" ||
                (
                    total >= Number(minTotal) &&
                    total < Number(minTotal) + 1
                );

            const matchesScorePercent =
                minScorePercent === "" ||
                (
                    scorePercent >= Number(minScorePercent) &&
                    scorePercent < Number(minScorePercent) + 1
                );

            const matchesFinalRating =
                minFinalRating === "" ||
                (
                    finalRating >= Number(minFinalRating) &&
                    finalRating < Number(minFinalRating) + 1
                );

            return (
                matchesSearch &&
                matchesCampus &&
                matchesApplicantStatus &&
                matchesRegistrarStatus &&
                matchesSubmittedDocs &&
                matchesRegistrarCurriculum &&
                matchesDepartment &&
                matchesProgram &&
                matchesSchoolYear &&
                matchesSemester &&
                matchesDateRange &&
                matchesTotal &&
                matchesScorePercent &&
                matchesFinalRating
            );
        })

        .sort((a, b) => {

            const getFinalRating = (person) => {
                const scores = subjects.map((subject) =>
                    Number(person.scores?.[subject.id] ?? 0)
                );

                const total = scores.reduce((sum, score) => sum + score, 0);

                return scores.length > 0
                    ? total / scores.length
                    : 0;
            };

            const aFinal = getFinalRating(a);
            const bFinal = getFinalRating(b);

            const dateA = parseDateOnlyLocal(a.created_at) || new Date(0);
            const dateB = parseDateOnlyLocal(b.created_at) || new Date(0);

            return dateA - dateB;
        });


    const [itemsPerPage, setItemsPerPage] = useState(100);

    const totalPages = Math.ceil(filteredPersons.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPersons = filteredPersons.slice(indexOfFirstItem, indexOfLastItem);

    const maxButtonsToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtonsToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxButtonsToShow - 1);

    if (endPage - startPage < maxButtonsToShow - 1) {
        startPage = Math.max(1, endPage - maxButtonsToShow + 1);
    }

    const visiblePages = [];
    for (let i = startPage; i <= endPage; i++) {
        visiblePages.push(i);
    }

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
                const mergedDepartments = responses.flatMap(
                    (response) => response.data || [],
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

        axios.get(`${API_BASE_URL}/api/applied_program`).then((res) => {
            const restrictedCurriculums = restrictToRegistrarCurriculum(res.data);
            setAllCurriculums(restrictedCurriculums);
            setCurriculumOptions(restrictedCurriculums);
        });
    }, [adminData.dprtmnt_id, adminData.dprtmnt_ids, scopeRevision]);

    useEffect(() => {
        if (department.length > 0 && allCurriculums.length > 0 && !selectedDepartmentFilter) {
            const firstDept = department[0].dprtmnt_name;
            setSelectedDepartmentFilter(firstDept);
            setCurriculumOptions(
                allCurriculums.filter((opt) => opt.dprtmnt_name === firstDept)
            );
        }
    }, [department, allCurriculums, selectedDepartmentFilter]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages || 1);
        }
    }, [filteredPersons.length, totalPages]);


    const handleSnackClose = (_, reason) => {
        if (reason === 'clickaway') return;
        setSnack(prev => ({ ...prev, open: false }));
    };



 

    const handleCampusChange = (branchId) => {
        setPerson(prev => ({ ...prev, campus: branchId }));
        if (!isProgramLocked) setSelectedProgramFilter("");
        setCurrentPage(1);

        // Re-apply department filter with first available department
        if (department.length > 0) {
            const firstDept = department[0].dprtmnt_name;
            setSelectedDepartmentFilter(firstDept);
            setCurriculumOptions(
                allCurriculums.filter((opt) => opt.dprtmnt_name === firstDept)
            );
        }
    };

    const handleDepartmentChange = (selectedDept) => {
        setSelectedDepartmentFilter(selectedDept);
        if (!selectedDept) {
            setCurriculumOptions(allCurriculums);
        } else {
            setCurriculumOptions(
                allCurriculums.filter((opt) => opt.dprtmnt_name === selectedDept)
            );
        }
        if (!isProgramLocked) setSelectedProgramFilter("");
        setCurrentPage(1);
    };


    const handleProgramFilterChange = (programCode) => {
        setSelectedProgramFilter(programCode);
        setCurrentPage(1);
    };



    const [applicants, setApplicants] = useState([]);
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

        const resolvedCampusAddress =
            campusAddress || "No address set in Settings";

        const htmlContent = `
  <html>
    <head>
      <title>Entrance Examination Scores</title>
      <style>
        @page { size: A4 landscape; margin: 5mm; }

        body {
          font-family: Arial;
          margin: 0;
          padding: 0;
        }

     .print-container {
     display: flex;
     flex-direction: column;
     align-items: center;
     text-align: center;
     padding-left: 10px;
     padding-right: 10px;
   }

       .print-header {
  position: relative;
  width: 100%;
  text-align: center;
  margin-top: 10px;
}

.print-header img {
  position: absolute;
  left: 220px;
  top: -10px;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  object-fit: cover;
}

.header-text {
  display: inline-block;
  padding-left: 100px;
}
        table {
     border-collapse: collapse;
     width: 100%;
     margin-top: 20px;
     border: 1.5px solid black;
     table-layout: fixed;
   }

        th, td {
          border: 1.5px solid black;
          padding: 7px 8px;
          font-size: 13px;
          text-align: center;
          word-wrap: break-word;
        }

        th {
          background-color: lightgray;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        th:last-child, td:last-child {
          border-right: 1.5px solid black !important;
        }

      </style>
    </head>

    <body onload="window.print(); setTimeout(() => window.close(), 100);">
              <div class="print-container">
   
             <!-- HEADER -->
    <div class="print-header">
  <img src="${logoSrc}" alt="School Logo" />

  <div class="header-text">
    <div style="font-size: 13px; font-family: Arial">
      Republic of the Philippines
    </div>

    ${name
                ? `
        <b style="letter-spacing: 1px; font-size: 20px; font-family: Arial, sans-serif;">
          ${firstLine}
        </b>
        ${secondLine
                    ? `<div style="letter-spacing: 1px; font-size: 20px; font-family: Arial, sans-serif;">
                 <b>${secondLine}</b>
               </div>`
                    : ""
                }
      `
                : ""
            }

    <div style="font-size: 13px; font-family: Arial">
      ${resolvedCampusAddress}
    </div>

    <div style="margin-top: 30px;">
      <b style="font-size: 24px; letter-spacing: 1px;">
        Entrance Examination Scores
      </b>
    </div>
  </div>
</div>

        <!-- TABLE -->
        <table>
          <thead>
            <tr>
              <th style="width:10%">Applicant ID</th>
              <th style="width:20%">Applicant Name</th>
              <th style="width:12%">Program</th>
              ${subjects.map(subject => `
              <th style="width:7%">
              ${subject.name}
              </th>
              `).join("")}
              <th style="width:8%">Total</th>
              <th style="width:8%">Score %</th>
              <th style="width:8%">Status</th>
            </tr>
          </thead>

          <tbody>
            ${filteredPersons.map((person) => {
                const subjectScores = subjects.map((subject) => {
                    return Number(person.scores?.[subject.id] ?? 0);
                });

                const totalScore = subjectScores.reduce((sum, score) => sum + score, 0);

                const maxTotal = subjects.reduce(
                    (sum, subject) => sum + Number(subject.max_score || 0),
                    0
                );

                const computedConvertedRating =
                    maxTotal > 0
                        ? ((totalScore / maxTotal) * 50) + 50
                        : 0;

                return `
                <tr>
                  <td>${person.applicant_number || ""}</td>
                  <td>${person.last_name}, ${person.first_name} ${person.middle_name || ""} ${person.extension || ""}</td>
                   <td>${allCurriculums.find(
                    (item) => item.curriculum_id?.toString() === person.program?.toString()
                )?.program_code ?? "N/A"
                    }</td>
              ${subjects.map(subject => {
                        const score = Number(person.scores?.[subject.id] ?? 0);
                        return `<td>${score}</td>`;
                    }).join("")}
                  <td>${totalScore}</td>
                  <td>${Number(computedConvertedRating).toFixed(2)}</td>
                  <td>${person.status === 0 ? "PASSED" :
                        person.status === 1 ? "FAILED" :
                            ""}</td>
                </tr>
              `;
            }).join("")}
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

    // Put this at the very bottom before the return 
    if (loading || hasAccess === null) {
        return <LoadingOverlay open={loading} message="Loading..." />;
    }

    if (!hasAccess) {
        return (
            <Unauthorized />
        );
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
                    ENTRANCE EXAMINATION SCORING
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
                        "& .MuiOutlinedInput-root": {
                            borderRadius: "10px",
                        },
                    }}
                    InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} />,
                    }}
                />
            </Box>

            <hr style={{ border: "1px solid #ccc", width: "100%" }} />

            <br />
            <br />

            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "nowrap",
                    width: "100%",
                    gap: 2,
                }}
            >
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
                            backgroundColor:
                                activeStep === index
                                    ? settings?.header_color || "#1976d2"
                                    : "#E8C999",
                            color: activeStep === index ? "#fff" : "#000",
                            boxShadow:
                                activeStep === index
                                    ? "0px 4px 10px rgba(0,0,0,0.3)"
                                    : "0px 2px 6px rgba(0,0,0,0.15)",
                            transition: "0.3s ease",
                            "&:hover": {
                                backgroundColor: activeStep === index ? "#000000" : "#f5d98f",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                            }}
                        >
                            <Box sx={{ fontSize: 40, mb: 1 }}>{tab.icon}</Box>
                            <Typography
                                sx={{ fontSize: 14, fontWeight: "bold", textAlign: "center" }}
                            >
                                {tab.label}
                            </Typography>
                        </Box>
                    </Card>
                ))}
            </Box>

            <br />
            <br />

            <TableContainer component={Paper} sx={{ width: '100%', border: `1px solid ${borderColor}`, }}>
                <Table>
                    <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2" }}>
                        <TableRow>
                            <TableCell sx={{ color: 'white', textAlign: "Center" }}>Entrance Examination Score</TableCell>
                        </TableRow>
                    </TableHead>
                </Table>
            </TableContainer>

            <TableContainer component={Paper} sx={{ width: "100%", border: `1px solid ${borderColor}`, p: 2 }}>
                <Box display="flex" justifyContent="space-between" flexWrap="wrap" rowGap={2}>
                    {/* Left Side: From and To Date */}
                    <Box display="flex" flexDirection="column" gap={2}>
                        {/* From Date + Print Button */}
                        <Box display="flex" alignItems="flex-end" gap={2}>

                            {/* From Date */}
                            <FormControl size="small" sx={{ width: 200 }}>
                                <InputLabel shrink htmlFor="from-date">From Date</InputLabel>
                                <DateField
                                    id="from-date"
                                    size="small"
                                    name="fromDate"
                                    value={person.fromDate || ""}
                                    onChange={(e) => setPerson(prev => ({ ...prev, fromDate: e.target.value }))}
                                />
                            </FormControl>

                        </Box>

                        {/* To Date */}
                        <Box display="flex" alignItems="flex-end" gap={2}>
                            <FormControl size="small" sx={{ width: 200 }}>
                                <InputLabel shrink htmlFor="to-date">To Date</InputLabel>
                                <DateField
                                    id="to-date"
                                    size="small"
                                    name="toDate"
                                    value={person.toDate || ""}
                                    onChange={(e) => setPerson(prev => ({ ...prev, toDate: e.target.value }))}
                                />
                            </FormControl>
                        </Box>
                    </Box>

                    {/* Right Side: Campus Dropdown */}
                    <Box display="flex" alignItems="flex-end" gap={2}>

                        {/* Campus Dropdown */}
                        <Box display="flex" flexDirection="column" gap={1}>
                            <Typography fontSize={13}>Campus:</Typography>

                            <FormControl size="small" sx={{ width: "200px" }}>
                                <InputLabel id="campus-label">Campus</InputLabel>
                                <Select
                                    labelId="campus-label"
                                    id="campus-select"
                                    name="campus"
                                    value={person.campus ?? ""}
                                    onChange={(e) => handleCampusChange(e.target.value)}
                                >
                                    <MenuItem value=""><em>All Campuses</em></MenuItem>

                                    {branches.map((branch) => (
                                        <MenuItem key={branch.id} value={String(branch.id)}>
                                            {branch.branch}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                        </Box>

                        {/* Print ECAT Score */}
                        <div style={{ position: "relative", zIndex: 999 }}>
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
                                    textAlign: "center",
                                    gap: "8px",
                                    userSelect: "none",
                                    width: "200px",
                                    pointerEvents: "auto",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#d3d3d3")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#f0f0f0")}
                                onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
                                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                                type="button"
                            >
                                <FcPrint size={20} />
                                Print ECAT Score
                            </button>
                        </div>

                    </Box>

                </Box>
            </TableContainer>



            <TableContainer component={Paper} sx={{ width: '100%', }}>
                <Table size="small">
                    <TableHead sx={{ backgroundColor: '#6D2323', color: "white" }}>
                        <TableRow>
                            <TableCell colSpan={10} sx={{ border: `1px solid ${borderColor}`, py: 0.5, backgroundColor: settings?.header_color || "#1976d2", color: "white" }}>
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    {/* Left: Total Count */}
                                    <Typography fontSize="14px" fontWeight="bold" color="white">
                                        Total Applicant's Records: {filteredPersons.length}
                                    </Typography>

                                    {/* Right: Pagination Controls */}
                                    <Box display="flex" alignItems="center" gap={1}>
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
                                                '&:hover': {
                                                    borderColor: 'white',
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                },
                                                '&.Mui-disabled': {
                                                    color: "white",
                                                    borderColor: "white",
                                                    backgroundColor: "transparent",
                                                    opacity: 1,
                                                }
                                            }}
                                        >
                                            First
                                        </Button>

                                        <Button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            variant="outlined"
                                            size="small"
                                            sx={{
                                                minWidth: 80,
                                                color: "white",
                                                borderColor: "white",
                                                backgroundColor: "transparent",
                                                '&:hover': {
                                                    borderColor: 'white',
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                },
                                                '&.Mui-disabled': {
                                                    color: "white",
                                                    borderColor: "white",
                                                    backgroundColor: "transparent",
                                                    opacity: 1,
                                                }
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
                                                    fontSize: '12px',
                                                    height: 36,
                                                    color: 'white',
                                                    border: '1px solid white',
                                                    backgroundColor: 'transparent',
                                                    '.MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'white',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'white',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'white',
                                                    },
                                                    '& svg': {
                                                        color: 'white',
                                                    }
                                                }}
                                                MenuProps={{
                                                    PaperProps: {
                                                        sx: {
                                                            maxHeight: 200,
                                                            backgroundColor: '#fff',
                                                        }
                                                    }
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
                                            of {totalPages} page{totalPages > 1 ? 's' : ''}
                                        </Typography>

                                        <Button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            variant="outlined"
                                            size="small"
                                            sx={{
                                                minWidth: 80,
                                                color: "white",
                                                borderColor: "white",
                                                backgroundColor: "transparent",
                                                '&:hover': {
                                                    borderColor: 'white',
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                },
                                                '&.Mui-disabled': {
                                                    color: "white",
                                                    borderColor: "white",
                                                    backgroundColor: "transparent",
                                                    opacity: 1,
                                                }
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
                                                '&:hover': {
                                                    borderColor: 'white',
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                },
                                                '&.Mui-disabled': {
                                                    color: "white",
                                                    borderColor: "white",
                                                    backgroundColor: "transparent",
                                                    opacity: 1,
                                                }
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


            <TableContainer component={Paper} sx={{ width: '100%', border: `1px solid ${borderColor}`, p: 2 }}>
                <Box display="flex" justifyContent="space-between" flexWrap="wrap" rowGap={3} columnGap={5}>

                    {/* LEFT COLUMN: Sorting */}
                    <Box display="flex" flexDirection="column" gap={2}>

                        <Box display="flex" alignItems="center" gap={1}>
                            <Typography fontSize={13} sx={{ minWidth: "10px" }}>Sort By:</Typography>
                            <FormControl size="small" sx={{ width: "200px" }}>
                                <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} displayEmpty>
                     
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
                    </Box>

                    {/* MIDDLE COLUMN: SY & Semester */}
                    <Box display="flex" flexDirection="column" gap={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Typography fontSize={13} sx={{ minWidth: "100px" }}>School Year:</Typography>
                            <FormControl size="small" sx={{ width: "200px" }}>
                                <InputLabel id="school-year-label">School Years</InputLabel>
                                <Select
                                    labelId="school-year-label"
                                    value={selectedSchoolYear}
                                    onChange={handleSchoolYearChange}
                                    displayEmpty
                                >
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
                                <Select
                                    labelId="semester-label"
                                    value={selectedSchoolSemester}
                                    onChange={handleSchoolSemesterChange}
                                    displayEmpty
                                >
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

                    {/* RIGHT COLUMN: Department & Program */}
                    <Box display="flex" flexDirection="column" gap={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Typography fontSize={13} sx={{ minWidth: "100px" }}>Department:</Typography>
                            <FormControl size="small" sx={{ width: "400px" }}>
                                <Select
                                    value={selectedDepartmentFilterValue}
                                    onChange={(e) => {
                                        const selectedDept = e.target.value;
                                        setSelectedDepartmentFilter(selectedDept);
                                        handleDepartmentChange(selectedDept);
                                    }}
                                    displayEmpty
                                >
                                    {/* REMOVE the "All Departments" MenuItem — QualifyingExamScore doesn't have it */}
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
                                    value={selectedProgramFilterValue}
                                    onChange={(e) => handleProgramFilterChange(e.target.value)}
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
                <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    flexWrap="wrap"
                    mt={3}
                >
                    {/* LEFT SIDE (SCORE FILTERS) */}
                    <Box>
                        <Typography
                            color="maroon"
                            sx={{ mb: 1, fontWeight: "bold" }}
                        >
                          Entrance Exam Total Score:
                        </Typography>

                        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">

                            <Typography fontSize={13}>Total:</Typography>
                            <TextField
                                label="Total"
                                size="small"
                                type="number"
                                value={minTotal}
                                onChange={(e) => setMinTotal(e.target.value)}
                            />

                            <Typography fontSize={13}>Score:</Typography>
                            <TextField
                                label="Score %"
                                size="small"
                                type="number"
                                value={minScorePercent}
                                onChange={(e) => setMinScorePercent(e.target.value)}
                            />

                        </Box>
                    </Box>
                </Box>

            </TableContainer>

            <div ref={divToPrintRef}>
            </div>


            <TableContainer component={Paper} sx={{ width: "100%" }}>
                <Table size="small">
                    <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2", }}>
                        <TableRow>
                            <TableCell sx={{ color: "white", textAlign: "center", width: "2%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>
                                #
                            </TableCell>

                            <TableCell sx={{ color: "white", textAlign: "center", width: "8%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>
                                Applicant ID
                            </TableCell>
                            <TableCell sx={{ color: "white", textAlign: "center", width: "25%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>
                                Name
                            </TableCell>
                            <TableCell sx={{ color: "white", textAlign: "center", width: "10%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>
                                Program
                            </TableCell>

                            {subjects.map((subject) => (
                                <TableCell sx={{ color: "white", textAlign: "center", width: "6%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}
                                    key={subject.id}>
                                    {subject.name}
                                </TableCell>
                            ))}

                            <TableCell sx={{ color: "white", textAlign: "center", width: "6%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>
                                Total
                            </TableCell>
                            <TableCell sx={{ color: "white", textAlign: "center", width: "6%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>
                                Score %
                            </TableCell>

                            <TableCell sx={{ color: "white", textAlign: "center", width: "5%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>
                                Date Applied
                            </TableCell>

                            <TableCell sx={{ color: "white", textAlign: "center", width: "12%", py: 0.5, fontSize: "12px", border: `1px solid ${borderColor}` }}>
                                Status
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {currentPersons.length === 0 && (
                            <TableRow>
                                <TableCell
                                    colSpan={13}
                                    sx={{
                                        textAlign: "center",
                                        border: `1px solid ${borderColor}`,
                                        color: "#777",
                                        py: 3,
                                    }}
                                >
                                    There's no applicant in the record.
                                </TableCell>
                            </TableRow>
                        )}
                        {currentPersons.map((person, index) => {
                            const subjectScores = subjects.map((subject) => {
                                return Number(person.scores?.[subject.id] ?? 0);
                            });

                            const totalScore = subjectScores.reduce((sum, score) => sum + score, 0);

                            const maxTotal = subjects.reduce(
                                (sum, subject) => sum + Number(subject.max_score || 0),
                                0
                            );

                            const computedConvertedRating =
                                maxTotal > 0
                                    ? ((totalScore / maxTotal) * 50) + 50
                                    : 0;

                            return (
                                <TableRow
                                    key={person.person_id}
                                    sx={{
                                        backgroundColor: index % 2 === 0 ? "#ffffff" : "lightgray",
                                    }}
                                >
                                    <TableCell sx={{
                                        color: "black",
                                        textAlign: "center",
                                        border: `1px solid ${borderColor}`,
                                        py: 0.5,
                                        fontSize: "15px",
                                    }}
                                    >{index + 1}</TableCell>

                                    <TableCell
                                        sx={{
                                            textAlign: "center",
                                            border: `1px solid ${borderColor}`,
                                            cursor: "pointer",
                                            color: "blue",
                                            fontSize: "12px",
                                        }}
                                        onClick={() => handleRowClick(person)}
                                    >
                                        {person.applicant_number}
                                    </TableCell>

                                    <TableCell
                                        sx={{
                                            textAlign: "center",
                                            border: `1px solid ${borderColor}`,
                                            cursor: "pointer",
                                            color: "blue",
                                            fontSize: "12px",
                                        }}
                                        onClick={() => handleRowClick(person)}
                                    >
                                        {`${person.last_name}, ${person.first_name} ${person.middle_name ?? ""}`}
                                    </TableCell>

                                    <TableCell
                                        sx={{
                                            color: "black",
                                            textAlign: "center",
                                            border: `1px solid ${borderColor}`,
                                            py: 0.5,
                                            fontSize: "15px",
                                        }}
                                    >
                                        {allCurriculums.find(
                                            (item) => item.curriculum_id?.toString() === person.program?.toString()
                                        )?.program_code ?? "N/A"}
                                    </TableCell>

                                    {/* READ-ONLY SCORE CELLS */}
                                    {subjects.map((subject) => (
                                        <TableCell
                                            key={subject.id}
                                            sx={{
                                                textAlign: "center",
                                                border: `1px solid ${borderColor}`,
                                                color: "black",
                                                fontSize: "14px",
                                                py: 0.5,
                                            }}
                                        >
                                            {Number(person.scores?.[subject.id] ?? 0)}
                                            <Typography
                                                component="span"
                                                sx={{
                                                    color: "#888",
                                                    fontSize: "12px",
                                                    ml: 0.5,
                                                }}
                                            >
                                                /{Number(subject.max_score || 0)}
                                            </Typography>
                                        </TableCell>
                                    ))}


                                    <TableCell
                                        sx={{
                                            color: "black",
                                            textAlign: "center",
                                            border: `1px solid ${borderColor}`,
                                            py: 0.5,
                                            fontSize: "15px",
                                        }}
                                    >
                                        {totalScore}
                                    </TableCell>

                                    <TableCell
                                        sx={{
                                            color: "black",
                                            textAlign: "center",
                                            border: `1px solid ${borderColor}`,
                                            py: 0.5,
                                            fontSize: "15px",
                                        }}
                                    >
                                        {Number(computedConvertedRating).toFixed(2)}
                                    </TableCell>

                                    {/* DATE APPLIED */}
                                    <TableCell
                                        sx={{ textAlign: "center", border: `1px solid ${borderColor}`, fontSize: "12px" }}
                                    >
                                        {(() => {
                                            if (!person.created_at.split("T")[0]) return "";

                                            const date = new Date(person.created_at.split("T")[0]);

                                            if (isNaN(date)) return person.created_at.split("T")[0];

                                            return date.toLocaleDateString("en-US", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                            });
                                        })()}
                                    </TableCell>

                                    {/* READ-ONLY STATUS */}
                                    <TableCell
                                        sx={{
                                            color: "black",
                                            textAlign: "center",
                                            border: `1px solid ${borderColor}`,
                                            py: 0.5,
                                            fontSize: "14px",
                                            fontWeight: "bold",
                                        }}
                                    >
                                        {person.status === 0
                                            ? <Typography sx={{ color: "green", fontWeight: "bold", fontSize: "14px" }}>Passed</Typography>
                                            : person.status === 1
                                                ? <Typography sx={{ color: "red", fontWeight: "bold", fontSize: "14px" }}>Failed</Typography>
                                                : <Typography sx={{ color: "#888", fontSize: "13px" }}>— No Status —</Typography>
                                        }
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <TableContainer component={Paper} sx={{ width: '100%', }}>
                <Table size="small">
                    <TableHead sx={{ backgroundColor: '#6D2323', color: "white" }}>
                        <TableRow>
                            <TableCell colSpan={10} sx={{ border: `1px solid ${borderColor}`, py: 0.5, backgroundColor: settings?.header_color || "#1976d2", color: "white" }}>
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    {/* Left: Total Count */}
                                    <Typography fontSize="14px" fontWeight="bold" color="white">
                                        Total Applicant's Records: {filteredPersons.length}
                                    </Typography>

                                    {/* Right: Pagination Controls */}
                                    <Box display="flex" alignItems="center" gap={1}>
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
                                                '&:hover': {
                                                    borderColor: 'white',
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                },
                                                '&.Mui-disabled': {
                                                    color: "white",
                                                    borderColor: "white",
                                                    backgroundColor: "transparent",
                                                    opacity: 1,
                                                }
                                            }}
                                        >
                                            First
                                        </Button>

                                        <Button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            variant="outlined"
                                            size="small"
                                            sx={{
                                                minWidth: 80,
                                                color: "white",
                                                borderColor: "white",
                                                backgroundColor: "transparent",
                                                '&:hover': {
                                                    borderColor: 'white',
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                },
                                                '&.Mui-disabled': {
                                                    color: "white",
                                                    borderColor: "white",
                                                    backgroundColor: "transparent",
                                                    opacity: 1,
                                                }
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
                                                    fontSize: '12px',
                                                    height: 36,
                                                    color: 'white',
                                                    border: '1px solid white',
                                                    backgroundColor: 'transparent',
                                                    '.MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'white',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'white',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'white',
                                                    },
                                                    '& svg': {
                                                        color: 'white',
                                                    }
                                                }}
                                                MenuProps={{
                                                    PaperProps: {
                                                        sx: {
                                                            maxHeight: 200,
                                                            backgroundColor: '#fff',
                                                        }
                                                    }
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
                                            of {totalPages} page{totalPages > 1 ? 's' : ''}
                                        </Typography>

                                        <Button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            variant="outlined"
                                            size="small"
                                            sx={{
                                                minWidth: 80,
                                                color: "white",
                                                borderColor: "white",
                                                backgroundColor: "transparent",
                                                '&:hover': {
                                                    borderColor: 'white',
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                },
                                                '&.Mui-disabled': {
                                                    color: "white",
                                                    borderColor: "white",
                                                    backgroundColor: "transparent",
                                                    opacity: 1,
                                                }
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
                                                '&:hover': {
                                                    borderColor: 'white',
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                },
                                                '&.Mui-disabled': {
                                                    color: "white",
                                                    borderColor: "white",
                                                    backgroundColor: "transparent",
                                                    opacity: 1,
                                                }
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
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackClose} severity={snack.severity} sx={{ width: '100%' }}>
                    {snack.message}
                </Alert>
            </Snackbar>

        </Box >
    );
};

export default ApplicantScoringReadOnly;
