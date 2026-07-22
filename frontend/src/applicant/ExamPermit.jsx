import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import EaristLogo from "../assets/EaristLogo.png";
import "../styles/Print.css";
import API_BASE_URL from "../apiConfig";

const ExamPermit = ({ personId }) => {
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
        if (settings?.branches) {
            try {
                const parsed = typeof settings.branches === "string"
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

    const divToPrintRef = useRef(null);
    const [examSchedule, setExamSchedule] = useState(null);
    const [curriculumOptions, setCurriculumOptions] = useState([]);
    const [scheduledBy, setScheduledBy] = useState("");

    const [person, setPerson] = useState({
        campus: "",
        profile_img: "",
        last_name: "",
        first_name: "",
        middle_name: "",
        extension: "",
        applicant_number: "",
    });

    const [campusAddress, setCampusAddress] = useState("");
    const [isVerified, setIsVerified] = useState(false);
    const [verifiedAt, setVerifiedAt] = useState(null);

    // ✅ PRIMARY fetch — gets person, applicant_number, verification, schedule, programs, registrar
    useEffect(() => {
        const pid = personId || localStorage.getItem("person_id");
        if (!pid) return;

        const fetchData = async () => {
            try {
                // Fetch person
                const res = await axios.get(`${API_BASE_URL}/api/person/${pid}`);
                let personData = res.data;

                // Fetch applicant number separately
                const applicantRes = await axios.get(`${API_BASE_URL}/api/applicant_number/${pid}`);
                if (applicantRes.data?.applicant_number) {
                    personData.applicant_number = applicantRes.data.applicant_number;
                }

                setPerson(personData);

                if (applicantRes.data?.applicant_number) {
                    const applicant_number = applicantRes.data.applicant_number;

                    // ✅ Use document-verification to get verified_at correctly
                    const verifyRes = await axios.get(
                        `${API_BASE_URL}/api/document-verification/${applicant_number}`
                    );
                    setIsVerified(Boolean(verifyRes.data?.verified));
                    setVerifiedAt(verifyRes.data?.verified ? verifyRes.data.verified_at : null);

                    // Load exam schedule
                    const schedRes = await axios.get(
                        `${API_BASE_URL}/api/exam-schedule/${applicant_number}`
                    );
                    setExamSchedule(schedRes.data);
                }

                // Fetch programs
                const progRes = await axios.get(`${API_BASE_URL}/api/applied_program`);
                setCurriculumOptions(progRes.data);

                // Fetch registrar (Scheduled By)
                const registrarRes = await axios.get(`${API_BASE_URL}/api/scheduled-by/registrar`);
                if (registrarRes.data?.fullName) {
                    setScheduledBy(registrarRes.data.fullName);
                }

            } catch (err) {
                console.error("Error fetching exam permit data:", err);
            }
        };

        fetchData();
    }, [personId]);

    // Campus address resolution
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

    if (!person) return <div>Loading Exam Permit...</div>;

    return (
        <div
            ref={divToPrintRef}
            className="exam-permit-container"
            style={{
                width: "8.5in",
                minHeight: "9in",
                backgroundColor: "white",
                padding: "20px",
                margin: "0 auto",
                position: "relative",
                marginTop: "10px",
                boxSizing: "border-box",
            }}
        >
            <style>{`
            @page {
              size: 8.5in 11in;
              margin: 0.25in 0.25in 0.25in 0.25in;
            }
            @media print {
              html, body {
                width: 8.5in;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              button { display: none; }
            }
            `}</style>

            {/* VERIFIED / NOT VERIFIED Watermark */}
            <div
                style={{
                    position: "absolute",
                    top: "26%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    fontSize: "120px",
                    fontWeight: "900",
                    color: isVerified ? "rgba(0, 128, 0, 0.15)" : "rgba(255, 0, 0, 0.15)",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    userSelect: "none",
                    zIndex: 0,
                    fontFamily: "Arial",
                    letterSpacing: "0.3rem",
                }}
            >
                {isVerified ? "VERIFIED" : "NOT VERIFIED"}
            </div>

            <style>{`
            @media print {
                div[style*="rotate(-30deg)"] {
                    color: ${isVerified ? "rgba(0, 128, 0, 0.25)" : "rgba(255, 0, 0, 0.25)"};
                }
                button { display: none; }
            }
            `}</style>

            {/* Header */}
            <table width="100%" style={{ borderCollapse: "collapse", marginTop: "-40px", fontFamily: "Arial" }}>
                <tbody>
                    <tr>
                        <td style={{ width: "20%", textAlign: "center" }}>
                            <img
                                src={fetchedLogo}
                                alt="School Logo"
                                style={{
                                    marginLeft: "-10px",
                                    width: "120px",
                                    height: "120px",
                                    marginTop: "10px",
                                    borderRadius: "50%",
                                    objectFit: "cover",
                                }}
                            />
                        </td>
                        <td style={{ width: "60%", textAlign: "center", lineHeight: "1" }}>
                            <div style={{ fontFamily: "Arial", fontSize: "13px" }}>
                                Republic of the Philippines
                            </div>
                            <div style={{ fontWeight: "bold", fontFamily: "Arial", fontSize: "20px" }}>
                                {firstLine}
                            </div>
                            {secondLine && (
                                <div style={{ fontWeight: "bold", fontFamily: "Arial", fontSize: "20px" }}>
                                    {secondLine}
                                </div>
                            )}
                            {campusAddress && (
                                <div style={{ fontFamily: "Arial", fontSize: "13px" }}>
                                    {campusAddress}
                                </div>
                            )}
                            <div style={{ marginTop: "30px" }}>
                                <b style={{ fontSize: "24px", letterSpacing: "1px", fontWeight: "bold" }}>
                                    EXAMINATION PERMIT
                                </b>
                            </div>
                        </td>
                        <td
                            colSpan={4}
                            rowSpan={6}
                            style={{
                                textAlign: "center",
                                position: "relative",
                                width: "4.5cm",
                                height: "4.5cm",
                            }}
                        >
                            <div
                                style={{
                                    width: "3.80cm",
                                    height: "3.80cm",
                                    marginRight: "10px",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    position: "relative",
                                    border: `1px solid ${borderColor}`,
                                    overflow: "hidden",
                                    borderRadius: "4px",
                                    marginTop: "10px",
                                }}
                            >
                                {person.profile_img ? (
                                    <img
                                        src={`${API_BASE_URL}/uploads/Applicant1by1/${person.profile_img}`}
                                        alt="Profile"
                                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                ) : (
                                    <span style={{ fontSize: "12px", color: "#888" }}>No Image</span>
                                )}
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <div style={{ height: "20px" }} />

            {/* Applicant Details Table */}
            <table
                className="student-table"
                style={{
                    borderCollapse: "collapse",
                    fontFamily: "Arial",
                    fontSize: "15px",
                    width: "8in",
                    margin: "0 auto",
                    tableLayout: "fixed",
                }}
            >
                <tbody>
                    {/* Applicant Number */}
                    <tr style={{ fontFamily: "Arial", fontSize: "15px" }}>
                        <td colSpan={40}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", width: "100%", gap: "10px" }}>
                                <label style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>
                                    Applicant No.:
                                </label>
                                <div style={{
                                    borderBottom: "1px solid black",
                                    fontFamily: "Arial",
                                    fontWeight: "normal",
                                    fontSize: "15px",
                                    minWidth: "278px",
                                    height: "1.2em",
                                    display: "flex",
                                    alignItems: "center",
                                }}>
                                    {person?.applicant_number}
                                </div>
                            </div>
                        </td>
                    </tr>

                    {/* Name + Permit No. */}
                    <tr>
                        <td colSpan={20}>
                            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                                <label style={{ fontWeight: "bold", marginRight: "10px" }}>Name:</label>
                                <span style={{ flexGrow: 1, borderBottom: "1px solid black", fontFamily: "Arial", minWidth: "250px" }}>
                                    {person?.last_name?.toUpperCase()}, {person?.first_name?.toUpperCase()}{" "}
                                    {person?.middle_name?.toUpperCase() || ""}{" "}
                                    {person?.extension?.toUpperCase() || ""}
                                </span>
                            </div>
                        </td>
                        <td colSpan={20}>
                            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                                <label style={{ fontWeight: "bold", marginRight: "10px" }}>Permit No.:</label>
                                <span style={{ flexGrow: 1, borderBottom: "1px solid black", minWidth: "200px", fontFamily: "Arial" }}>
                                    {person?.applicant_number}
                                </span>
                            </div>
                        </td>
                    </tr>

                    {/* Course + Major */}
                    <tr>
                        <td colSpan={20}>
                            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                                <label style={{ fontWeight: "bold", marginRight: "10px" }}>Course Applied:</label>
                                <span style={{ flexGrow: 1, borderBottom: "1px solid black", minWidth: "220px", fontFamily: "Arial" }}>
                                    {curriculumOptions.find(
                                        (c) => c.curriculum_id?.toString() === (person?.program ?? "").toString()
                                    )?.program_description || ""}
                                </span>
                            </div>
                        </td>
                        <td colSpan={20}>
                            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                                <label style={{ fontWeight: "bold", marginRight: "10px" }}>Major:</label>
                                <span style={{ flexGrow: 1, borderBottom: "1px solid black", minWidth: "200px", fontFamily: "Arial" }}>
                                    {curriculumOptions.find(
                                        (c) => c.curriculum_id?.toString() === (person?.program ?? "").toString()
                                    )?.major || ""}
                                </span>
                            </div>
                        </td>
                    </tr>

                    {/* Date of Exam + Time */}
                    <tr style={{ fontFamily: "Arial", fontSize: "15px" }}>
                        <td colSpan={20}>
                            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                                <label style={{ fontWeight: "bold", whiteSpace: "nowrap", marginRight: "10px" }}>Date of Exam:</label>
                                <span style={{ flexGrow: 1, borderBottom: "1px solid black", height: "1.2em", fontFamily: "Arial", textAlign: "left" }}>
                                    {examSchedule?.schedule_created_at
                                        ? new Date(examSchedule.schedule_created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                                        : ""}
                                </span>
                            </div>
                        </td>
                        <td colSpan={20}>
                            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                                <label style={{ fontWeight: "bold", whiteSpace: "nowrap", marginRight: "10px" }}>Time:</label>
                                <span style={{ flexGrow: 1, borderBottom: "1px solid black", height: "1.2em", fontFamily: "Arial", textAlign: "left" }}>
                                    {examSchedule
                                        ? new Date(`1970-01-01T${examSchedule.start_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
                                        : ""}
                                </span>
                            </div>
                        </td>
                    </tr>

                    {/* Bldg + Room + QR */}
                    <tr style={{ fontFamily: "Arial", fontSize: "15px" }}>
                        <td colSpan={20}>
                            <div style={{ display: "flex", alignItems: "center", width: "100%", marginTop: "-85px", gap: "8px" }}>
                                <label style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>Bldg. :</label>
                                <span style={{ flexGrow: 1, borderBottom: "1px solid black", height: "1.2em", fontFamily: "Arial", textAlign: "left" }}>
                                    {examSchedule?.building_description || ""}
                                </span>
                                <label style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>Floor :</label>
                                <span style={{ minWidth: "40px", borderBottom: "1px solid black", height: "1.2em", fontFamily: "Arial", textAlign: "left" }}>
                                    {examSchedule?.floor || ""}
                                </span>
                            </div>
                        </td>
                        <td colSpan={20}>
                            <div style={{ display: "flex", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", marginTop: "-130px" }}>
                                    <label style={{ fontWeight: "bold", marginRight: "10px", width: "80px" }}>Room No.:</label>
                                    <span style={{ flexGrow: 1, borderBottom: "1px solid black", fontFamily: "Arial", width: "150px" }}>
                                        {examSchedule?.room_description || ""}
                                    </span>
                                </div>
                                {person?.applicant_number && (
                                    <div style={{
                                        width: "4.5cm",
                                        height: "4.5cm",
                                        borderRadius: "4px",
                                        background: "#fff",
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        position: "relative",
                                        overflow: "hidden",
                                        marginLeft: "10px",
                                    }}>
                                        <QRCodeSVG
                                            value={`${window.location.origin}/applicant_profile/${person.applicant_number}`}
                                            size={150}
                                            level="H"
                                        />
                                        <div style={{
                                            position: "absolute",
                                            fontSize: "12px",
                                            fontWeight: "bold",
                                            color: "maroon",
                                            background: "white",
                                            padding: "2px 4px",
                                            borderRadius: "2px",
                                        }}>
                                            {person.applicant_number}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </td>
                    </tr>

                    {/* Date Verified */}
                    <tr style={{ fontFamily: "Arial", fontSize: "15px" }}>
                        <td colSpan={20}>
                            <div style={{ display: "flex", alignItems: "center", width: "100%", marginTop: "-148px" }}>
                                <label style={{ fontWeight: "bold", whiteSpace: "nowrap", marginRight: "10px" }}>Date Verified:</label>
                                <span style={{ flexGrow: 1, borderBottom: "1px solid black", height: "1.2em", fontFamily: "Arial", textAlign: "left" }}>
                                    {verifiedAt
                                        ? new Date(verifiedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                                        : ""}
                                </span>
                            </div>
                        </td>
                    </tr>

                    {/* Scheduled By */}
                    <tr style={{ fontFamily: "Arial", fontSize: "15px" }}>
                        <td colSpan={20}>
                            <div style={{ display: "flex", alignItems: "center", width: "100%", marginTop: "-128px" }}>
                                <label style={{ fontWeight: "bold", whiteSpace: "nowrap", marginRight: "10px" }}>Scheduled by:</label>
                                <span style={{ flexGrow: 1, borderBottom: "1px solid black", fontFamily: "Arial" }}>
                                    {scheduledBy || "N/A"}
                                </span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            <table className="student-table" style={{ borderCollapse: "collapse", fontFamily: "Arial", width: "8in", margin: "0 auto", textAlign: "center", tableLayout: "fixed", border: "1px solid black" }}>
                <tbody>
                    <tr>
                        <td colSpan={40} style={{ color: "black", padding: "12px", lineHeight: "1.6", textAlign: "left", fontSize: "14px", fontFamily: "Arial" }}>
                            <strong>IMPORTANT REMINDERS FOR APPLICANTS:</strong>
                            <ul style={{ marginTop: "8px" }}>
                                <strong>Step 1:</strong> Check your Examination Date, Time, and Room Number indicated on your permit.<br />
                                <strong>Step 2:</strong> Bring all required items on the exam day:
                                <ul><li>Official Examination Permit with VERIFIED watermark on it</li><li>No. 2 Pencil (any brand)</li><li>2 Short bond papers</li></ul>
                                <strong>Step 3:</strong> Wear the proper attire:
                                <ul><li>Plain white T-shirt or plain white polo shirt <strong>(no prints, no logos, no designs)</strong></li><li>Pants (Shorts and ripped jeans are not allowed)</li><li>Closed shoes (no crocs, sandals, slippers)</li></ul>
                                <strong>Step 4:</strong> Keep the two paper sheets attached to your exam permit.<br />
                                <strong>Step 5:</strong> Please Arrive at least 1 hour before your examination time. Late applicants will NOT be allowed to enter once the exam room door closes.
                                <br /><br />
                                <div style={{ textAlign: "center", marginLeft: "-50px" }}><strong>GOOD LUCK TO ALL ASPIRING APPLICANTS!</strong></div>
                            </ul>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default ExamPermit;