import React, { useState, useRef, useEffect, useContext } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "../styles/Container.css";
import Logo from "../assets/Logo.png";
import {
  Container,
  Box,
  Snackbar,
  Alert,
  TextField,
  Modal,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  CircularProgress,
  IconButton,
} from "@mui/material";
import {
  Email as EmailIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  Person as PersonIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Badge as BadgeIcon,
  Cake as CakeIcon,
  PhoneAndroid as PhoneAndroidIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import CloseIcon from "@mui/icons-material/Close";
import CampaignIcon from "@mui/icons-material/Campaign";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { SettingsContext } from "../App";
import API_BASE_URL from "../apiConfig";
import AnnouncementSlider from "../components/AnnouncementSlider";
import RedirectLoading from "../components/RedirectLoading";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Autocomplete from "@mui/material/Autocomplete";
import { motion, AnimatePresence } from "framer-motion";
import MuiLink from "@mui/material/Link";

/* ─── Device breakpoint hooks ───────────────────────────────────────────────
   Three tiers instead of one: phones get their own compact layout, tablets
   get a wider single-column layout (previously tablets fell into whichever
   bucket happened to straddle 768px, which broke iPads and Android tablets
   in portrait), and desktop/laptop keeps the original two-column layout.
════════════════════════════════════════════════════════════════════════════ */
const MOBILE_BP = 600;   // phones
const TABLET_BP = 1024;  // tablets (portrait + landscape up to ~1024px)

const useIsMobile = (bp = MOBILE_BP) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= bp : false
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= bp);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [bp]);
  return isMobile;
};

const useIsTablet = (min = MOBILE_BP, max = TABLET_BP) => {
  const getVal = () =>
    typeof window !== "undefined" &&
    window.innerWidth > min &&
    window.innerWidth <= max;
  const [isTablet, setIsTablet] = useState(getVal);
  useEffect(() => {
    const handler = () => setIsTablet(getVal());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [min, max]);
  return isTablet;
};

/* ─── Formats announcement text with bullets / line-breaks ─── */
const FormattedContent = ({ text, style = {} }) => {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px", ...style }}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: "5px" }} />;

        const subBullet = line.match(/^[\s\t]{2,}[•*\-–]\s+(.*)/);
        if (subBullet) {
          return (
            <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start", paddingLeft: "14px" }}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", marginTop: "3px", flexShrink: 0 }}>◦</span>
              <span style={{ color: "rgba(255,255,255,0.8)", fontSize: "12.5px", lineHeight: 1.55 }}>{subBullet[1]}</span>
            </div>
          );
        }

        const bullet = trimmed.match(/^[•*\-–]\s+(.*)/);
        if (bullet) {
          return (
            <div key={i} style={{ display: "flex", gap: "7px", alignItems: "flex-start" }}>
              <span style={{ color: "#fff", fontSize: "13px", marginTop: "2px", flexShrink: 0 }}>•</span>
              <span style={{ color: "rgba(255,255,255,0.92)", fontSize: "13px", lineHeight: 1.55 }}>{bullet[1]}</span>
            </div>
          );
        }

        if (trimmed.startsWith("#")) {
          return (
            <p key={i} style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.45)", fontSize: "11.5px", lineHeight: 1.5 }}>
              {trimmed}
            </p>
          );
        }

        return (
          <p key={i} style={{ margin: 0, color: "rgba(255,255,255,0.9)", fontSize: "13px", lineHeight: 1.6 }}>
            {trimmed}
          </p>
        );
      })}
    </div>
  );
};

/* ─── Fullscreen Announcement Viewer Modal (mobile) ─── */
const AnnouncementViewerModal = ({ slides, startIndex, onClose }) => {
  const [index, setIndex] = useState(startIndex || 0);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const current = slides[index];

  const goNext = () => { setIndex((prev) => (prev + 1) % slides.length); setScale(1); setShowContent(false); };
  const goPrev = () => { setIndex((prev) => (prev - 1 + slides.length) % slides.length); setScale(1); setShowContent(false); };

  const handleDragEnd = (_, info) => {
    if (scale > 1) return;
    if (Math.abs(info.offset.x) < Math.abs(info.offset.y)) { setIsDragging(false); return; }
    if (info.offset.x < -60) goNext();
    else if (info.offset.x > 60) goPrev();
    setIsDragging(false);
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!current) return null;

  const hasImage = !!current.file_path;
  const hasContent = !!(current.content?.trim());

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(0,0,0,0.97)",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", background: "rgba(0,0,0,0.8)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <CampaignIcon sx={{ color: "#fff", fontSize: 18, flexShrink: 0 }} />
          <span style={{
            color: "#fff", fontWeight: 600, fontSize: "13px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {current.title}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
          {hasImage && (
            <>
              <button onClick={() => setScale((s) => Math.min(s + 0.5, 3))}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 34, height: 34, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ZoomInIcon sx={{ fontSize: 18 }} />
              </button>
              <button onClick={() => setScale((s) => Math.max(s - 0.5, 1))}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 34, height: 34, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ZoomOutIcon sx={{ fontSize: 18 }} />
              </button>
            </>
          )}
          <button onClick={onClose}
            style={{ background: "rgba(220,38,38,0.85)", border: "none", borderRadius: "50%", width: 34, height: 34, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>

      {hasImage && (
        <div style={{
          flex: showContent ? "0 0 45%" : "1 1 auto",
          position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "flex 0.3s ease",
          minHeight: 0,
        }}>
          {slides.length > 1 && (
            <button onClick={goPrev} style={{
              position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              zIndex: 10, background: "rgba(255,255,255,0.18)", border: "none", borderRadius: "50%",
              width: 38, height: 38, color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ArrowBackIosNewIcon sx={{ fontSize: 17 }} />
            </button>
          )}
          {slides.length > 1 && (
            <button onClick={goNext} style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              zIndex: 10, background: "rgba(255,255,255,0.18)", border: "none", borderRadius: "50%",
              width: 38, height: 38, color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ArrowForwardIosIcon sx={{ fontSize: 17 }} />
            </button>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              drag={scale <= 1 ? "x" : false}
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.03}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                touchAction: scale > 1 ? "pinch-zoom" : "pan-y",
              }}
            >
              <img
                src={`${API_BASE_URL}/uploads/Announcement/${current.file_path}`}
                alt={current.title}
                draggable={false}
                style={{
                  maxWidth: "100%", maxHeight: "100%",
                  objectFit: "contain",
                  transform: `scale(${scale})`,
                  transformOrigin: "center center",
                  transition: "transform 0.2s ease",
                  userSelect: "none",
                  borderRadius: scale > 1 ? 0 : "6px",
                }}
              />
            </motion.div>
          </AnimatePresence>

          {scale > 1 && (
            <div style={{
              position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "11px",
              padding: "4px 10px", borderRadius: "20px", pointerEvents: "none",
            }}>
              {Math.round(scale * 100)}% — tap − to zoom out
            </div>
          )}
        </div>
      )}

      {hasContent && (
        <button
          onClick={() => setShowContent((v) => !v)}
          style={{
            flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 16px",
            background: showContent ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)",
            border: "none", borderTop: "1px solid rgba(255,255,255,0.12)",
            color: "#fff", cursor: "pointer", fontSize: "12.5px", fontWeight: 600,
            transition: "background 0.2s",
          }}
        >
          {showContent ? <KeyboardArrowDownIcon sx={{ fontSize: 18 }} /> : <KeyboardArrowUpIcon sx={{ fontSize: 18 }} />}
          {showContent ? "Hide announcement details" : "Show full announcement"}
          {!showContent && (
            <span style={{
              background: "rgba(255,255,255,0.2)", borderRadius: "10px",
              padding: "1px 7px", fontSize: "10.5px", marginLeft: 2,
            }}>
              tap to read
            </span>
          )}
        </button>
      )}

      {hasContent && showContent && (
        <div style={{
          flex: hasImage ? "0 0 auto" : "1 1 auto",
          maxHeight: hasImage ? "48%" : "100%",
          overflowY: "auto",
          background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
          padding: "16px 18px 20px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.2) transparent",
        }}>
          <p style={{ margin: "0 0 10px", color: "#fff", fontWeight: 700, fontSize: "13.5px", lineHeight: 1.4 }}>
            {current.title}
          </p>
          <div style={{ width: 28, height: 2, background: "rgba(255,255,255,0.3)", borderRadius: 2, marginBottom: 12 }} />
          <FormattedContent text={current.content} />
        </div>
      )}

      <div style={{
        padding: "10px 14px", background: "rgba(0,0,0,0.8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, gap: 10,
      }}>
        {slides.length > 1 && slides.map((_, i) => (
          <div key={i} onClick={() => { setIndex(i); setScale(1); setShowContent(false); }}
            style={{
              width: i === index ? 18 : 7, height: 7, borderRadius: 4,
              background: i === index ? "#fff" : "rgba(255,255,255,0.35)",
              transition: "all 0.3s", cursor: "pointer",
            }} />
        ))}
        {slides.length > 1 && (
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginLeft: 2 }}>
            {index + 1} / {slides.length}
          </span>
        )}
      </div>
    </div>
  );
};

/* ─── Compact mobile announcement banner ─── */
const MobileAnnouncementBanner = ({ slides }) => {
  const [openViewer, setOpenViewer] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);
  const [index, setIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const [expandedContent, setExpandedContent] = useState(true);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setTimeout(() => setIndex((prev) => (prev + 1) % slides.length), 4500);
    return () => clearTimeout(t);
  }, [index, slides.length]);

  useEffect(() => { setExpandedContent(true); }, [index]);

  if (!slides.length) return null;
  const current = slides[index];
  if (!current) return null;

  const hasImage = !!current.file_path;
  const hasContent = !!(current.content?.trim());

  const goNext = () => setIndex((prev) => (prev + 1) % slides.length);
  const goPrev = () => setIndex((prev) => (prev - 1 + slides.length) % slides.length);

  const handleDragEnd = (_, info) => {
    if (Math.abs(info.offset.x) < Math.abs(info.offset.y)) { setIsDragging(false); return; }
    if (info.offset.x < -60) goNext();
    else if (info.offset.x > 60) goPrev();
    setIsDragging(false);
  };

  const handleOpenViewer = () => {
    setViewerStartIndex(index);
    setOpenViewer(true);
  };

  return (
    <>
      {openViewer && (
        <AnnouncementViewerModal
          slides={slides}
          startIndex={viewerStartIndex}
          onClose={() => setOpenViewer(false)}
        />
      )}

      {!bannerVisible && (
        <button onClick={() => setBannerVisible(true)} style={{
          width: "100%", marginBottom: "14px", padding: "10px",
          background: "rgba(0,0,0,0.08)", border: "1.5px dashed rgba(0,0,0,0.25)",
          borderRadius: "10px", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 6,
          color: "rgba(0,0,0,0.55)", fontSize: "13px", fontWeight: 500,
        }}>
          <CampaignIcon sx={{ fontSize: 16 }} />
          Show Announcements
        </button>
      )}

      {bannerVisible && (
        <div style={{
          width: "100%",
          borderRadius: "14px",
          overflow: "hidden",
          marginBottom: "16px",
          boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
          background: "#000",
          border: "1.5px solid rgba(0,0,0,0.15)",
        }}>
          {hasImage && (
            <div style={{ position: "relative", aspectRatio: "16 / 9", background: "#000" }}>
              <button onClick={() => setBannerVisible(false)} style={{
                position: "absolute", top: 8, right: 8, zIndex: 20,
                background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
                width: 28, height: 28, color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CloseIcon sx={{ fontSize: 14 }} />
              </button>

              <button onClick={handleOpenViewer} style={{
                position: "absolute", top: 8, left: 8, zIndex: 20,
                background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "20px",
                padding: "4px 10px", color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                fontSize: "11px", fontWeight: 600,
              }}>
                <ZoomInIcon sx={{ fontSize: 14 }} />
                View
              </button>

              <button onClick={goPrev} style={{
                position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                zIndex: 10, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%",
                width: 34, height: 34, color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
              </button>

              <button onClick={goNext} style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                zIndex: 10, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%",
                width: 34, height: 34, color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
              </button>

              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  drag="x"
                  dragDirectionLock
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.03}
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={handleDragEnd}
                  initial={{ x: 120, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -120, opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  style={{ width: "100%", height: "100%", position: "relative", touchAction: "pan-y" }}
                >
                  <img
                    src={`${API_BASE_URL}/uploads/Announcement/${current.file_path}`}
                    alt={current.title}
                    onClick={handleOpenViewer}
                    style={{
                      width: "100%", height: "100%",
                      objectFit: "cover", userSelect: "none",
                      display: "block", cursor: "zoom-in",
                    }}
                    draggable={false}
                  />
                  <div style={{
                    position: "absolute", bottom: 0, width: "100%",
                    padding: "1.8rem 0.9rem 0.6rem",
                    background: "linear-gradient(transparent, rgba(0,0,0,0.78))",
                    color: "#fff", pointerEvents: "none",
                  }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "0.82rem", lineHeight: 1.3 }}>
                      {current.title}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {slides.length > 1 && (
                <div style={{
                  position: "absolute", bottom: 8, right: 10,
                  display: "flex", gap: 5, zIndex: 10,
                }}>
                  {slides.map((_, i) => (
                    <div key={i} onClick={() => setIndex(i)} style={{
                      width: i === index ? 16 : 6, height: 6,
                      borderRadius: 3,
                      background: i === index ? "#fff" : "rgba(255,255,255,0.45)",
                      transition: "all 0.3s", cursor: "pointer",
                    }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {hasContent && (
            <button
              onClick={() => setExpandedContent((v) => !v)}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: expandedContent
                  ? "linear-gradient(135deg, #1a1a2e, #16213e)"
                  : "linear-gradient(135deg, #1a1a2e, #0f3460)",
                border: "none", cursor: "pointer",
                borderTop: hasImage ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <CampaignIcon sx={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }} />
                <span style={{ color: "#fff", fontSize: "12.5px", fontWeight: 600 }}>
                  {expandedContent ? "Hide details" : "Read full announcement"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {!expandedContent && (
                  <span style={{
                    background: "rgba(255,255,255,0.18)", borderRadius: "10px",
                    padding: "2px 8px", fontSize: "10.5px", color: "rgba(255,255,255,0.85)",
                  }}>
                    tap to read
                  </span>
                )}
                {expandedContent
                  ? <KeyboardArrowUpIcon sx={{ color: "#fff", fontSize: 18 }} />
                  : <KeyboardArrowDownIcon sx={{ color: "#fff", fontSize: 18 }} />
                }
              </div>
            </button>
          )}

          {hasContent && expandedContent && (
            <div style={{
              background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
              padding: "14px 16px 18px",
              maxHeight: "260px",
              overflowY: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.2) transparent",
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}>
              {!hasImage && (
                <>
                  <p style={{ margin: "0 0 8px", color: "#fff", fontWeight: 700, fontSize: "13.5px", lineHeight: 1.4 }}>
                    {current.title}
                  </p>
                  <div style={{ width: 28, height: 2, background: "rgba(255,255,255,0.3)", borderRadius: 2, marginBottom: 12 }} />
                </>
              )}
              <FormattedContent text={current.content} />
            </div>
          )}
        </div>
      )}
    </>
  );
};

/* ═══════════════════════════════════════════════════════════
   PASSWORD RULES
   Applicants are unfamiliar with password requirements, so the
   rules are shown up front (English + Tagalog) and validated
   live as they type.
════════════════════════════════════════════════════════════ */
const passwordRules = [
  {
    label: "Minimum of 8 characters",
    test: (pw) => pw.length >= 8,
  },
  {
    label: "At least one lowercase letter (e.g. abc)",
    test: (pw) => /[a-z]/.test(pw),
  },
  {
    label: "At least one uppercase letter (e.g. ABC)",
    test: (pw) => /[A-Z]/.test(pw),
  },
  {
    label: "At least one number (e.g. 123)",
    test: (pw) => /\d/.test(pw),
  },
  {
    label: "At least one special character (! # $ ^ * @ - . < > _ & % + = ?)",
    test: (pw) => /[!#$^*@\-.<>_&%+=?]/.test(pw),
  },
];

const getPasswordRuleResults = (pw = "") =>
  passwordRules.map((rule) => ({ ...rule, passed: rule.test(pw) }));

/* ─── Bilingual password requirements notice + live checklist ─── */
const PasswordRulesNotice = ({ password, isMobile, mainButtonColor, showChecklist }) => {
  const results = getPasswordRuleResults(password);

  return (
    <Box sx={{ mt: 1.5, mb: 1 }}>
      {/* Bilingual "important notice" explaining WHY, in plain terms */}
      <Box sx={{
        display: "flex", gap: 1.25, alignItems: "flex-start",
        bgcolor: "#fff8e6", border: "1.5px solid #f5a623",
        borderRadius: "10px", p: 1.5, mb: showChecklist ? 1.25 : 0,
      }}>
        <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>🔐</span>
        <Box>
          <Typography sx={{ fontSize: isMobile ? "12px" : "13px", color: "#5d4037", fontWeight: 700, lineHeight: 1.5 }}>
            IMPORTANT: Your password MUST follow all the rules below.
          </Typography>
          <Typography sx={{ fontSize: isMobile ? "11.5px" : "12.5px", color: "#5d4037", lineHeight: 1.6, mt: 0.4 }}>
            We're showing this now so you get familiar with it early — the same rules will be
            required every time you make or change a password on this system.
          </Typography>

        </Box>
      </Box>

      {/* Live checklist */}
      {showChecklist && (
        <Box sx={{
          border: "1.5px solid #ddd", borderRadius: "10px",
          p: 1.5, bgcolor: "#fafafa",
        }}>
          <Typography sx={{ fontSize: isMobile ? "11px" : "12px", color: "#666", fontWeight: 700, mb: 1, letterSpacing: "0.03em" }}>
            PASSWORD REQUIREMENTS
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.9 }}>
            {results.map((rule, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                <span style={{
                  flexShrink: 0, marginTop: 1, fontSize: 14,
                  color: rule.passed ? "#2e7d32" : "#bdbdbd",
                }}>
                  {rule.passed ? "✅" : "⬜"}
                </span>
                <Box>
                  <Typography sx={{
                    fontSize: isMobile ? "12px" : "12.5px",
                    color: rule.passed ? "#2e7d32" : "#000000",
                    fontWeight: rule.passed ? 700 : 500,
                    lineHeight: 1.45,
                  }}>
                    {rule.label}
                  </Typography>
                  <Typography sx={{
                    fontSize: isMobile ? "11px" : "12px",
                    color: rule.passed ? "#2e7d32" : "#000000",
                    fontStyle: "italic",
                    lineHeight: 1.45,
                  }}>

                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

/* ═══════════════════════════════════════════════════════════
   TOTP SETUP MODAL
   - Step 1: show QR code for user to scan (two columns —
             instructions on the left, QR code on the right)
   - Step 2: user enters the 6-digit code to confirm setup,
             then the full /register call is made
   Bilingual (English / Tagalog) throughout so applicants who
   are more comfortable in Tagalog aren't lost mid-setup.
════════════════════════════════════════════════════════════ */
const TotpSetupModal = ({
  open,
  onClose,
  onSuccess,
  email,
  mainButtonColor,
  isMobile,
  // All the registration payload fields passed through
  registrationPayload,
}) => {
  // step: "loading" | "scan" | "verify" | "submitting"
  const [step, setStep] = useState("loading");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrScale, setQrScale] = useState(1);
  const [manualKey, setManualKey] = useState("");
  const [showManualKey, setShowManualKey] = useState(false);
  const [totpCode, setTotpCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [snack, setSnack] = useState({ open: false, message: "", severity: "info" });
  const inputRefs = useRef([]);

  // Fetch QR code as soon as modal opens
  useEffect(() => {
    if (!open || !email) return;
    setStep("loading");
    setError("");
    setTotpCode(["", "", "", "", "", ""]);
    setShowManualKey(false);
    setQrScale(1);

    axios
      .post(`${API_BASE_URL}/api/register-totp-setup`, { email })
      .then((res) => {
        if (res.data.success) {
          setQrDataUrl(res.data.qrDataUrl);
          setManualKey(res.data.manualKey);
          setStep("scan");
        } else {
          setError(res.data.message || "Failed to generate QR code.");
          setStep("scan"); // show error in modal
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to generate authenticator setup.");
        setStep("scan");
      });
  }, [open, email]);

  const handleDigitChange = (value, index) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...totpCode];
    next[index] = value;
    setTotpCode(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleDigitKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (totpCode[index]) {
        const next = [...totpCode];
        next[index] = "";
        setTotpCode(next);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
    if (e.key === "Enter") handleVerifyAndRegister();
  };

  const handleVerifyAndRegister = async () => {
    const code = totpCode.join("");
    if (!/^\d{6}$/.test(code)) {
      setError("Please enter the complete 6-digit code from Google Authenticator.");
      return;
    }
    setError("");
    setStep("submitting");

    try {
      const response = await axios.post(`${API_BASE_URL}/api/register`, {
        ...registrationPayload,
        otp: code,
      });

      if (!response.data.success) {
        setError(response.data.message || "Registration failed.");
        setStep("verify");
        return;
      }

      onSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
      setStep("verify");
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={step === "submitting" ? undefined : onClose}>
      <Box sx={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: isMobile ? "calc(100% - 32px)" : (step === "scan" ? 760 : 480),
        maxWidth: step === "scan" ? 760 : 480,
        bgcolor: "#fff",
        borderRadius: "20px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",

        outline: "none",
        maxHeight: "90vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* ── Colored header bar ── */}
        {step !== "loading" && (
          <Box sx={{
            bgcolor: mainButtonColor,
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            px: isMobile ? 2.5 : 3,
            py: 2,
            flexShrink: 0,
          }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{
                width: 40, height: 40, borderRadius: "50%",
                bgcolor: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {step === "scan" ? (
                  <PhoneAndroidIcon sx={{ color: "#fff", fontSize: 21 }} />
                ) : (
                  <CheckCircleIcon sx={{ color: "#fff", fontSize: 21 }} />
                )}
              </Box>
              <Box>
                <Typography fontWeight={700} fontSize={isMobile ? 15 : 17} color="white" lineHeight={1.2}>
                  {step === "scan" ? "Set Up Google Authenticator" : "Enter Authenticator Code"}
                </Typography>
                <Typography fontSize={12} color="rgba(255,255,255,0.85)" lineHeight={1.3}>
                  {step === "scan"
                    ? "One-time setup — Step 1 of 2"
                    : "Step 2 of 2 — Confirm & complete registration"}
                </Typography>

              </Box>
            </Box>

            <IconButton
              onClick={onClose}
              disabled={step === "submitting"}
              sx={{
                color: "white",
                border: "2px solid rgba(255,255,255,0.6)",
                borderRadius: "50%",
                width: 40,
                height: 40,
                padding: 0,
                flexShrink: 0,
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.2)",
                  border: "2px solid white",
                },
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}

        {/* ── Body (scrollable) ── */}
        <Box sx={{ p: isMobile ? 2.5 : 3.5, overflowY: "auto" }}>

          {/* ── Loading state ── */}
          {step === "loading" && (
            <Box sx={{ textAlign: "center", py: 5 }}>
              <CircularProgress sx={{ color: mainButtonColor }} />
              <Typography sx={{ mt: 2, color: "#666", fontSize: "14px" }}>
                Generating your authenticator QR code…
              </Typography>

            </Box>
          )}

          {/* ── Scan QR step: left = instructions, right = QR code ── */}
          {step === "scan" && (
            <Box sx={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? 2.5 : 3.5,
              alignItems: "flex-start",
            }}>
              {/* LEFT: Instructions */}
              <Box sx={{ flex: 1.15, minWidth: 0, width: "100%" }}>
                <Box
                  sx={{
                    bgcolor: "#f8f9ff",
                    borderRadius: "12px",
                    p: 2,
                    mb: 2,
                    border: "1px solid #e8eaff",
                  }}
                >
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>

                    {/* Step 1 label */}
                    <Box>
                      <Typography fontSize={13} color="#444" fontWeight={600}>
                        1. Download and install <strong>Google Authenticator</strong>:
                      </Typography>

                    </Box>

                    {/* Download buttons — each on its own row */}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, pl: 1 }}>
                      <Box sx={{
                        display: "flex", alignItems: "center", gap: 1,
                        bgcolor: "#fff", border: "1px solid #dde3ff",
                        borderRadius: "8px", px: 1.5, py: 1,
                      }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>📱</span>
                        <MuiLink
                          href="https://apps.apple.com/app/google-authenticator/id388497605"
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="always"
                          fontWeight="bold"
                          fontSize={13}
                          color="inherit"
                        >
                          App Store <span style={{ fontWeight: 400, color: "#888" }}>(iPhone / iPad)</span>
                        </MuiLink>
                      </Box>

                      <Box sx={{
                        display: "flex", alignItems: "center", gap: 1,
                        bgcolor: "#fff", border: "1px solid #dde3ff",
                        borderRadius: "8px", px: 1.5, py: 1,
                      }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>🤖</span>
                        <MuiLink
                          href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="always"
                          fontWeight="bold"
                          fontSize={13}
                          color="inherit"
                        >
                          Google Play <span style={{ fontWeight: 400, color: "#888" }}>(Android)</span>
                        </MuiLink>
                      </Box>
                    </Box>

                    {/* Step 2 */}
                    <Box>
                      <Typography fontSize={13} color="#444" lineHeight={1.6}>
                        <strong>2.</strong> Open the app → tap <strong>"+"</strong> → <strong>"Scan a QR code"</strong>.
                      </Typography>

                    </Box>

                    {/* Step 3 */}
                    <Box>
                      <Typography fontSize={13} color="#444" lineHeight={1.6}>
                        <strong>3.</strong> Scan the QR code shown on the right.
                      </Typography>

                    </Box>

                  </Box>
                </Box>

                {/* Manual key fallback */}
                {manualKey && (
                  <Box sx={{ mb: 2 }}>
                    <button
                      onClick={() => setShowManualKey((v) => !v)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: mainButtonColor, fontSize: "13px", fontWeight: 600,
                        padding: 0, textDecoration: "underline",
                      }}
                    >
                      {showManualKey ? "Hide manual key" : "Can't scan? Enter key manually"}
                    </button>

                    {showManualKey && (
                      <Box sx={{
                        mt: 1, p: "10px 14px",
                        bgcolor: "#f5f5f5", borderRadius: "8px",
                        border: "1px solid #ddd",
                        fontFamily: "monospace",
                        fontSize: isMobile ? "12px" : "13.5px",
                        letterSpacing: "0.08em",
                        color: "#222",
                        wordBreak: "break-all",
                        userSelect: "all",
                      }}>
                        {manualKey}
                      </Box>
                    )}
                    {showManualKey && (
                      <>
                        <Typography fontSize={11.5} color="#888" sx={{ mt: 0.5 }}>
                          In Google Authenticator: tap + → Enter a setup key → paste this key, select "Time based".
                        </Typography>

                      </>
                    )}
                  </Box>
                )}

                {/* Warning about 10-min expiry */}
                <Box sx={{
                  display: "flex", gap: 1, alignItems: "flex-start",
                  bgcolor: "#fffbf2", border: "1px solid #f5a623",
                  borderRadius: "8px", p: 1.5,
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⏱️</span>
                  <Box>
                    <Typography fontSize={12} color="#5d4037" lineHeight={1.5}>
                      This QR code expires in <strong>10 minutes</strong>. If it expires, close this dialog and click "Submit Application" again.
                    </Typography>

                  </Box>
                </Box>
              </Box>

              {/* RIGHT: QR code */}
              <Box sx={{
                flex: 1,
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                ...(isMobile ? {} : {
                  position: "sticky",
                  top: 0,
                  borderLeft: "1px solid #eee",
                  pl: 3.5,
                }),
              }}>
                {error ? (
                  <Box sx={{
                    border: "1px solid #f44336", borderRadius: "12px",
                    p: 2, textAlign: "center", width: "100%",
                  }}>
                    <Typography color="error" fontSize={13}>{error}</Typography>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: "center" }}>
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Google Authenticator QR Code"
                        style={{
                          width: (isMobile ? 190 : 220) * qrScale,
                          height: (isMobile ? 190 : 220) * qrScale,
                          border: "3px solid #000",
                          borderRadius: "12px",
                          display: "inline-block",
                          transition: "width 0.2s ease, height 0.2s ease",
                        }}
                      />
                    ) : (
                      <Box sx={{
                        width: 220, height: 220,
                        bgcolor: "#f5f5f5", borderRadius: "12px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        mx: "auto",
                      }}>
                        <CircularProgress size={32} sx={{ color: mainButtonColor }} />
                      </Box>
                    )}
                  </Box>
                )}

                {/* Zoom controls for the QR code */}
                {!error && qrDataUrl && (
                  <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 1.5 }}>
                    <button
                      onClick={() => setQrScale((s) => Math.min(s + 0.25, 1.6))}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "#f0f0f0", border: "1px solid #ddd", borderRadius: "20px",
                        padding: "5px 12px", fontSize: "12px", fontWeight: 600, color: "#333",
                        cursor: "pointer",
                      }}
                    >
                      <ZoomInIcon sx={{ fontSize: 16 }} /> Zoom in
                    </button>
                    <button
                      onClick={() => setQrScale((s) => Math.max(s - 0.25, 1))}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "#f0f0f0", border: "1px solid #ddd", borderRadius: "20px",
                        padding: "5px 12px", fontSize: "12px", fontWeight: 600, color: "#333",
                        cursor: "pointer",
                      }}
                    >
                      <ZoomOutIcon sx={{ fontSize: 16 }} /> Zoom out
                    </button>
                  </Box>
                )}

                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => {
                    setStep("verify");
                    setError("");
                    setTotpCode(["", "", "", "", "", ""]);
                    setTimeout(() => inputRefs.current[0]?.focus(), 150);
                  }}
                  disabled={!!error || !qrDataUrl}
                  sx={{
                    mt: 2.5,
                    backgroundColor: mainButtonColor,
                    color: "#fff", fontWeight: 700,
                    fontSize: "15px", borderRadius: "12px",
                    py: 1.25, textTransform: "none",
                    "&:hover": { backgroundColor: mainButtonColor, opacity: 0.92 },
                  }}
                >
                  I've scanned it — Enter the code →
                </Button>

              </Box>
            </Box>
          )}

          {/* ── Verify code step ── */}
          {(step === "verify" || step === "submitting") && (
            <>
              <Box sx={{
                bgcolor: "#f8f9ff", borderRadius: "12px",
                p: 2, mb: 2.5, border: "1px solid #e8eaff",
              }}>
                <Typography fontSize={13} color="#444" lineHeight={1.7}>
                  Open <strong>Google Authenticator</strong> on your phone and enter the <strong>6-digit code</strong> shown for this account.
                </Typography>

                <Typography fontSize={12} color="#888" sx={{ mt: 0.8 }}>
                  The code refreshes every 30 seconds — use the current one.
                </Typography>

              </Box>

              {/* 6-digit input boxes */}
              <Box sx={{ display: "flex", justifyContent: "center", gap: isMobile ? 1 : 1.5, mb: 2.5 }}>
                {totpCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(e.target.value, index)}
                    onKeyDown={(e) => handleDigitKeyDown(e, index)}
                    disabled={step === "submitting"}
                    style={{
                      width: isMobile ? "42px" : "54px",
                      height: isMobile ? "52px" : "62px",
                      fontSize: "24px",
                      fontWeight: 700,
                      textAlign: "center",
                      borderRadius: "12px",
                      border: error ? "2px solid #f44336" : "2px solid #ddd",
                      outline: "none",
                      background: step === "submitting" ? "#f5f5f5" : "#fff",
                      transition: "border 0.2s",
                    }}
                  />
                ))}
              </Box>

              {error && (
                <Box sx={{
                  bgcolor: "#fff5f5", border: "1px solid #f44336",
                  borderRadius: "8px", p: 1.5, mb: 2,
                }}>
                  <Typography fontSize={13} color="#c62828">{error}</Typography>
                </Box>
              )}

              <Button
                fullWidth
                variant="contained"
                onClick={handleVerifyAndRegister}
                disabled={step === "submitting"}
                sx={{
                  backgroundColor: mainButtonColor,
                  color: "#fff", fontWeight: 700,
                  fontSize: "15px", borderRadius: "12px",
                  py: 1.5, textTransform: "none", mb: 0.5,
                  "&:hover": { backgroundColor: mainButtonColor, opacity: 0.92 },
                }}
              >
                {step === "submitting" ? (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <CircularProgress size={18} sx={{ color: "#fff" }} />
                    Registering…
                  </Box>
                ) : "Verify & Complete Registration"}
              </Button>


              {/* Back to QR scan */}
              <Button
                fullWidth
                color="error"
                variant="outlined"
                onClick={() => { setStep("scan"); setError(""); }}
                disabled={step === "submitting"}
                sx={{
                  fontWeight: 600, fontSize: "13px",
                  borderRadius: "12px", py: 1.25,
                  textTransform: "none", color: "#555",

                }}
              >
                ← Back to QR code
              </Button>

            </>
          )}
        </Box>
      </Box>
    </Modal>
  );
};

/* ═══════════════════════════════════════
   REGISTER PAGE
════════════════════════════════════════ */
const Register = () => {
  const settings = useContext(SettingsContext);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  // isCompact = "not enough width for the two-column desktop layout" —
  // covers both phones and tablets so neither breaks the container.
  const isCompact = isMobile || isTablet;

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
  const [openReminder, setOpenReminder] = useState(true);

  useEffect(() => {
    if (!settings) return;
    if (settings.title_color) setTitleColor(settings.title_color);
    if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
    if (settings.border_color) setBorderColor(settings.border_color);
    if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
    if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
    if (settings.stepper_color) setStepperColor(settings.stepper_color);
    if (settings.logo_url) setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
    if (settings.company_name) setCompanyName(settings.company_name);
    if (settings.short_term) setShortTerm(settings.short_term);
    if (settings.campus_address) setCampusAddress(settings.campus_address);
    if (settings.branches) {
      setBranches(
        typeof settings.branches === "string"
          ? JSON.parse(settings.branches)
          : settings.branches
      );
    }
  }, [settings]);

  const getBranchLabel = (branchId) => {
    const branch = branches.find((item) => String(item.id) === String(branchId));
    return branch?.branch || "—";
  };

  const [usersData, setUserData] = useState({ email: "", password: "" });
  const [emailDomainStatus, setEmailDomainStatus] = useState(null); // null | "checking" | "valid" | "invalid"
  const [emailDomainSuggestion, setEmailDomainSuggestion] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "info" });
  const navigate = useNavigate();

  const passwordRuleResults = getPasswordRuleResults(usersData.password);
  const allPasswordRulesPassed = passwordRuleResults.every((r) => r.passed);
  const passwordTouched = passwordFocused || usersData.password.length > 0;

  const handleChanges = (e) => {
    const { name, value } = e.target;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmailBlur = async () => {
    const email = usersData.email.trim();
    const at = email.lastIndexOf("@");
    if (at === -1 || at === email.length - 1) {
      setEmailDomainStatus(null);
      setEmailDomainSuggestion(null);
      return;
    }
    const domain = email.slice(at + 1).toLowerCase();
    if (!domain) {
      setEmailDomainStatus(null);
      setEmailDomainSuggestion(null);
      return;
    }

    setEmailDomainStatus("checking");
    try {
      const res = await axios.get(`${API_BASE_URL}/api/check-domain-mx`, {
        params: { domain },
      });
      setEmailDomainStatus(res.data.valid ? "valid" : "invalid");
      setEmailDomainSuggestion(res.data.suggestion || null);

      if (res.data.suggestion) {
        setSnack({
          open: true,
          message: `This looks like a typo. Did you mean "${res.data.suggestion}"? Please correct it before submitting.`,
          severity: "warning",
        });
      }
    } catch {
      setEmailDomainStatus(null);
      setEmailDomainSuggestion(null);
    }
  };


  const [agreeChecked, setAgreeChecked] = useState(false);
  const [reminderChecked, setReminderChecked] = useState(false);
  const [currentYear, setCurrentYear] = useState("");

  useEffect(() => {
    const now = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    setCurrentYear(new Date(now).getFullYear());
  }, []);

  const handleClose = (_, reason) => {
    if (reason === "clickaway") return;
    setSnack((prev) => ({ ...prev, open: false }));
  };

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [academicProgram, setAcademicProgram] = useState("");
  const [applyingAs, setApplyingAs] = useState("");
  const [selectedCurriculum, setSelectedCurriculum] = useState("");
  const [curriculumOptions, setCurriculumOptions] = useState([]);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");

  // ── NEW: TOTP modal state ──────────────────────────────────────────────────
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [tempEmail, setTempEmail] = useState("");
  // Snapshot of the full payload to pass into TotpSetupModal
  const [registrationPayload, setRegistrationPayload] = useState(null);
  // ──────────────────────────────────────────────────────────────────────────

  const [redirectLoading, setRedirectLoading] = useState(false);

  // Compact (mobile + tablet) announcement slides
  const [mobileSlides, setMobileSlides] = useState([]);
  useEffect(() => {
    if (!isCompact) return;
    axios.get(`${API_BASE_URL}/api/announcements`)
      .then((res) => { if (Array.isArray(res.data.data)) setMobileSlides(res.data.data); })
      .catch(() => { });
  }, [isCompact]);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/branches`)
      .then((res) => setBranches(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/applied_program`)
      .then((res) => setCurriculumOptions(res.data))
      .catch((err) => console.error("Error fetching curriculum options:", err));
  }, []);

  const [errors, setErrors] = useState({});

  const [programAvailability, setProgramAvailability] = useState([]);
  const [activeSchoolYearId, setActiveSchoolYearId] = useState(null);
  const [activeYearId, setActiveYearId] = useState(null);
  const [activeSemesterId, setActiveSemesterId] = useState(null);

  useEffect(() => {
    const fetchActiveYearAndAvailability = async () => {
      const yearRes = await axios.get(`${API_BASE_URL}/api/active_school_year`);
      const activeYear = yearRes.data[0];
      if (activeYear) {
        setActiveSchoolYearId(activeYear.school_year_id);
        setActiveYearId(activeYear.year_id);
        setActiveSemesterId(activeYear.semester_id);
        const availRes = await axios.get(`${API_BASE_URL}/api/programs/availability`, {
          params: { year_id: activeYear.year_id, semester_id: activeYear.semester_id },
        });
        setProgramAvailability(availRes.data);
      }
    };
    fetchActiveYearAndAvailability();
  }, []);

  const availabilityMap = React.useMemo(() => {
    const map = {};
    programAvailability.forEach((p) => {
      map[p.curriculum_id] = { remaining: Number(p.remaining), isFull: Number(p.remaining) <= 0 };
    });
    return map;
  }, [programAvailability]);

  useEffect(() => {
    if (!selectedCurriculum) return;
    const availability = availabilityMap[selectedCurriculum];
    if (availability?.isFull) {
      setSelectedCurriculum("");
      setSnack({ open: true, message: "Selected course is now FULL. Please choose another.", severity: "warning" });
    }
  }, [availabilityMap]);

  const isFormValid = () => {
    let newErrors = {};
    let isValid = true;
    if (!branchId) { newErrors.campus = true; isValid = false; }
    if (!lastName) { newErrors.lastName = true; isValid = false; }
    if (!firstName) { newErrors.firstName = true; isValid = false; }
    if (!birthday) { newErrors.birthday = true; isValid = false; }
    if (!academicProgram) { newErrors.academicProgram = true; isValid = false; }
    if (!applyingAs) { newErrors.applyingAs = true; isValid = false; }
    if (!selectedCurriculum) { newErrors.selectedCurriculum = true; isValid = false; }
    if (!usersData.email) { newErrors.email = true; isValid = false; }
    if (!usersData.password) { newErrors.password = true; isValid = false; }
    else if (!allPasswordRulesPassed) { newErrors.password = true; newErrors.passwordRules = true; isValid = false; }
    if (!confirmPassword) { newErrors.confirmPassword = true; isValid = false; }
    setErrors(newErrors);
    return isValid;
  };

  const getIconTop = (hasError) => hasError ? "55%" : "70%";

  // ── UPDATED: handleRegister now opens TotpSetupModal instead of email OTP ─
  const handleRegister = async () => {
    if (isSubmitting) return;

    if (emailDomainSuggestion) {
      setSnack({
        open: true,
        message: `Please fix the suspected typo in your email before submitting. Did you mean "${emailDomainSuggestion}"?`,
        severity: "warning",
      });
      return;
    }
    if (emailDomainStatus === "invalid") {
      setSnack({
        open: true,
        message: "This email domain doesn't appear to accept mail. Please correct it before submitting.",
        severity: "error",
      });
      return;
    }

    if (!reminderChecked) {
      setSnack({ open: true, message: "You must agree to the Terms and Conditions before registering.", severity: "warning" });
      return;
    }
    if (usersData.password && !allPasswordRulesPassed) {
      setSnack({
        open: true,
        message: "Your password doesn't meet all the requirements yet. Please check the checklist below the password field.",
        severity: "warning",
      });
      return;
    }
    if (!isFormValid()) {
      setSnack({ open: true, message: "Please fill up all required fields!", severity: "warning" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!branchId || !registrationOpen) {
      setSnack({ open: true, message: "Registration is closed for this campus.", severity: "error" });
      return;
    }
    if (!emailRegex.test(usersData.email)) {
      setSnack({ open: true, message: "Please enter a valid email address!", severity: "error" });
      return;
    }
    if (usersData.password !== confirmPassword) {
      setSnack({ open: true, message: "Passwords do not match!", severity: "error" });
      return;
    }

    const normalizedEmail = usersData.email.trim().toLowerCase();
    setIsSubmitting(true);

    try {
      // Step 1: duplicate check (same as before)
      await axios.post(`${API_BASE_URL}/api/check-registration-duplicate`, {
        email: normalizedEmail,
        firstName,
        lastName,
        birthday,
      });

      // Step 2: Build and stash the full registration payload
      // The `otp` field will be filled in by TotpSetupModal when the user
      // enters their Google Authenticator code.
      setTempEmail(normalizedEmail);
      setRegistrationPayload({
        ...usersData,
        email: normalizedEmail,
        campus: branchId,
        lastName,
        firstName,
        middleName,
        birthday,
        academicProgram,
        applyingAs,
        program: selectedCurriculum,
        active_school_year_id: activeSchoolYearId,
        audit_log_db: "db",
      });

      // Step 3: Open the TOTP modal (it calls /register-totp-setup internally)
      setShowTotpModal(true);
    } catch (error) {
      setSnack({
        open: true,
        message: error.response?.data?.message || "Validation failed. Please try again.",
        severity: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Called by TotpSetupModal on successful /register response
  const handleTotpSuccess = () => {
    setShowTotpModal(false);
    setRedirectLoading(true);
    setTimeout(() => navigate("/login_applicant"), 3000);
  };

  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [openClosedDialog, setOpenClosedDialog] = useState(false);
  const [openBranchDialog, setOpenBranchDialog] = useState(false);

  const handleBranchSelect = (e) => {
    const selectedId = e.target.value;
    setBranchId(selectedId);
    setAcademicProgram("");
    setApplyingAs("");
    setSelectedCurriculum("");
  };

  useEffect(() => {
    if (!branchId) return;
    const fetchRegistrationStatus = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/registration-status/${branchId}`);
        const isOpen = res.data.registration_open === 1;
        setRegistrationOpen(isOpen);
        if (!isOpen) setOpenBranchDialog(true);
      } catch (err) { console.error(err); }
    };
    fetchRegistrationStatus();
  }, [branchId]);

  const branchSelected = !!branchId;
  const fieldDisabled = !branchSelected || !registrationOpen;
  const selectedBranch = branches.find((b) => b.id.toString() === branchId);

  const filteredCurriculum = React.useMemo(() => {
    const filtered = curriculumOptions.filter((item) => {
      if (branchId && Number(item.components) !== Number(branchId)) return false;
      if (academicProgram && Number(item.academic_program) !== Number(academicProgram)) return false;
      return true;
    });
    const uniqueMap = new Map();
    filtered.forEach((item) => { if (!uniqueMap.has(item.curriculum_id)) uniqueMap.set(item.curriculum_id, item); });
    return Array.from(uniqueMap.values());
  }, [curriculumOptions, branchId, academicProgram]);

  const handleKeyDownRegister = (e) => {
    if (e.key === "Enter" && !isSubmitting) {
      if (!branchId) { setSnack({ open: true, message: "Please select a branch!", severity: "warning" }); return; }
      if (!registrationOpen) { setSnack({ open: true, message: "Registration is closed for this campus.", severity: "error" }); return; }
      handleRegister();
    }
  };

  const backgroundImage = settings?.bg_image
    ? `url(${API_BASE_URL}${settings.bg_image})`
    : "url(/default-bg.jpg)";

  // 🔒 Right-click / DevTools-shortcut blocking — desktop (mouse + keyboard)
  // only. Previously this ran on every render with no cleanup (piling up
  // duplicate listeners) and unconditionally blocked the context menu,
  // which on many mobile browsers also blocks the long-press "Paste" menu —
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

  if (redirectLoading) return <RedirectLoading message="Account created! Redirecting to login..." />;

  const inputH = isMobile ? "44px" : "45px";

  return (
    <>
      <Box sx={{
        backgroundImage,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        alignItems: isCompact ? "flex-start" : "center",
        justifyContent: "center",
        overflowY: isCompact ? "auto" : "hidden",
        overflowX: "hidden",
        py: isCompact ? 2 : 0,
      }}>
        <Container
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: isCompact ? "column" : "row",
            padding: isCompact ? "0" : undefined,
          }}
          maxWidth={false}
        >
          {!isCompact && <AnnouncementSlider campusId={branchId} targetRole="applicant" />}

          <div
            style={{
              border: isCompact ? "3px solid black" : "5px solid black",
              marginLeft: isCompact ? 0 : -100,
              marginTop: isCompact ? 0 : "-50px",
              width: isCompact ? "calc(100% - 32px)" : undefined,
              maxWidth: isCompact ? (isTablet ? 640 : 520) : undefined,
              boxSizing: "border-box",
            }}
            className="Container"
          >
            {/* Header */}
            <div className="Header" style={{
              backgroundColor: settings?.header_color || "#1976d2",
              padding: isMobile ? "12px 10px" : "1rem 0",
              borderBottom: "3px solid black",
            }}>
              <div className="HeaderTitle">
                <div className="CircleCon">
                  <img src={settings?.logo_url ? `${API_BASE_URL}${settings.logo_url}` : Logo} alt="Logo" />
                </div>
              </div>
              <div className="HeaderBody">
                <strong style={{ color: "white" }}>
                  {(settings?.company_name || "Company Name").split(" ").reduce((acc, word, i) => {
                    if (i % 4 === 0 && i !== 0) acc.push(<br key={`br-${i}`} />);
                    acc.push(word + " ");
                    return acc;
                  }, [])}
                </strong>
                <p>Academic Information System</p>
              </div>
            </div>

            {/* Body */}
            <div className="Body">

              {isCompact && mobileSlides.length > 0 && (
                <MobileAnnouncementBanner slides={mobileSlides} />
              )}

              {/* Campus */}
              <div className="TextField">
                <label style={{ color: "black" }}>Campus<span style={{ color: "red" }}> *</span></label>
                <select value={branchId} onChange={handleBranchSelect} className="border" required
                  style={{ height: inputH, fontSize: "16px", border: errors.campus ? "2px solid red" : "2px solid black", width: "100%", appearance: "none", WebkitAppearance: "none", MozAppearance: "none", paddingRight: "2.2rem" }}>
                  <option value="">Select Campus</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.branch}</option>)}
                </select>
                <ArrowDropDownIcon sx={{ position: "absolute", right: "10px", top: "70%", transform: "translateY(-50%)", fontSize: "30px", color: "black", pointerEvents: "none" }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", margin: "1.2rem 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
                <span style={{ margin: "0 0.8rem", fontWeight: "600", color: "#555", fontSize: isMobile ? "13px" : "14px", whiteSpace: "nowrap" }}>Personal Information</span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? "0" : "1rem" }}>
                <div className="TextField" style={{ position: "relative" }}>
                  <label style={{ color: "black" }}>Last Name<span style={{ color: "red" }}> *</span></label>
                  <input type="text" placeholder="Enter your last name" required disabled={fieldDisabled}
                    value={lastName} onChange={(e) => setLastName(e.target.value.toUpperCase())}
                    onKeyDown={handleKeyDownRegister} className="border"
                    style={{ paddingLeft: "2.5rem", height: inputH, fontSize: "16px", border: errors.lastName ? "2px solid red" : "2px solid black", width: "100%" }} />
                  <BadgeIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem", fontSize: "20px" }} />
                  {errors.lastName && <span style={{ color: "red", fontSize: "12px" }}>This field is required</span>}
                </div>

                <div className="TextField" style={{ position: "relative" }}>
                  <label style={{ color: "black" }}>First Name<span style={{ color: "red" }}> *</span></label>
                  <input type="text" required placeholder="Enter your first name" value={firstName} disabled={fieldDisabled}
                    onChange={(e) => setFirstName(e.target.value.toUpperCase())} onKeyDown={handleKeyDownRegister} className="border"
                    style={{ paddingLeft: "2.5rem", height: inputH, fontSize: "16px", border: errors.firstName ? "2px solid red" : "2px solid black", width: "100%" }} />
                  <PersonIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem", fontSize: "20px" }} />
                  {errors.firstName && <span style={{ color: "red", fontSize: "12px" }}>This field is required</span>}
                </div>

                <div className="TextField" style={{ position: "relative" }}>
                  <label style={{ color: "black" }}>Middle Name (Optional)</label>
                  <input type="text" placeholder="Enter your middle name" value={middleName} disabled={fieldDisabled}
                    onChange={(e) => setMiddleName(e.target.value.toUpperCase())} onKeyDown={handleKeyDownRegister} className="border"
                    style={{ paddingLeft: "2.5rem", height: inputH, fontSize: "16px", border: "2px solid black", width: "100%" }} />
                  <PersonIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem", fontSize: "20px" }} />
                </div>

                <div className="TextField" style={{ position: "relative" }}>
                  <label style={{ color: "black" }}>Birth Date<span style={{ color: "red" }}> *</span></label>
                  <input type="date" required value={birthday} disabled={fieldDisabled}
                    onChange={(e) => setBirthday(e.target.value)} onKeyDown={handleKeyDownRegister} className="border"
                    style={{ paddingLeft: "2.5rem", height: inputH, fontSize: "16px", border: errors.birthday ? "2px solid red" : "2px solid black", width: "100%" }} />
                  <CakeIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem", fontSize: "20px" }} />
                  {errors.birthday && <span style={{ color: "red", fontSize: "12px" }}>This field is required</span>}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", margin: "1.2rem 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
                <span style={{ margin: "0 0.8rem", fontWeight: "600", color: "#555", fontSize: isMobile ? "13px" : "14px", whiteSpace: "nowrap" }}>Academic Information</span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
              </div>

              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", flexDirection: isMobile ? "column" : "row" }}>
                <div className="TextField" style={{ position: "relative", flex: 1 }}>
                  <label style={{ color: "black" }}>Academic Program<span style={{ color: "red" }}> *</span></label>
                  <select required value={academicProgram} disabled={fieldDisabled}
                    onChange={(e) => { setAcademicProgram(e.target.value); setApplyingAs(""); setSelectedCurriculum(""); }}
                    className="border"
                    style={{ paddingLeft: "1rem", height: inputH, fontSize: "16px", border: errors.academicProgram ? "2px solid red" : "2px solid black", width: "100%", appearance: "none", paddingRight: "2.2rem" }}>
                    <option value="">Select Program</option>
                    {selectedBranch?.academicPrograms?.filter((prog) => prog.open === 1).map((prog) => (
                      <option key={prog.id} value={prog.id}>{prog.name}</option>
                    ))}
                  </select>
                  {errors.academicProgram && <span style={{ color: "red", fontSize: "12px" }}>This field is required</span>}
                  <ArrowDropDownIcon sx={{ position: "absolute", right: "10px", top: getIconTop(errors.academicProgram), transform: "translateY(-50%)", fontSize: "30px", pointerEvents: "none" }} />
                </div>

                <div className="TextField" style={{ position: "relative", flex: 1 }}>
                  <label style={{ color: "black" }}>Applying As<span style={{ color: "red" }}> *</span></label>
                  <select required value={applyingAs} disabled={fieldDisabled}
                    onChange={(e) => {
                      if (!academicProgram) { setSnack({ open: true, message: "Please select Academic Program first.", severity: "warning" }); return; }
                      setApplyingAs(e.target.value); setSelectedCurriculum("");
                    }}
                    className="border"
                    style={{ paddingLeft: "1rem", height: inputH, fontSize: "16px", border: errors.applyingAs ? "2px solid red" : "2px solid black", width: "100%", appearance: "none", paddingRight: "2.2rem" }}>
                    <option value="">Select Applying</option>
                    {(() => {
                      const selectedProgram = selectedBranch?.academicPrograms?.find((prog) => prog.id.toString() === academicProgram);
                      if (!selectedProgram) return null;
                      const name = selectedProgram.name.toLowerCase();
                      if (name.includes("undergraduate")) return (
                        <>
                          <option value="1">Senior High School Graduate</option>
                          <option value="2">Senior High School Graduating Student</option>
                          <option value="3">ALS Passer</option>
                          <option value="4">Transferee</option>
                          <option value="5">Cross Enrollee</option>
                          <option value="6">Foreign Applicant</option>
                        </>
                      );
                      if (name.includes("graduate") || name.includes("master") || name.includes("baccalaureate")) return (
                        <>
                          <option value="7">Baccalaureate Graduate</option>
                          <option value="8">Master Degree Graduate</option>
                        </>
                      );
                      return null;
                    })()}
                  </select>
                  {errors.applyingAs && <span style={{ color: "red", fontSize: "12px" }}>This field is required</span>}
                  <ArrowDropDownIcon sx={{ position: "absolute", right: "10px", top: getIconTop(errors.applyingAs), transform: "translateY(-50%)", fontSize: "30px", pointerEvents: "none" }} />
                </div>
              </div>

              <div className="TextField" style={{ position: "relative" }}>
                <label style={{ color: "black" }}>Course Applied<span style={{ color: "red" }}> *</span></label>
                <Autocomplete
                  disabled={fieldDisabled || !academicProgram}
                  options={filteredCurriculum}
                  getOptionLabel={(option) =>
                    `(${option.program_code}): ${option.program_description}${option.major ? ` (${option.major})` : ""} (${getBranchLabel(option.components)})`
                  }
                  value={filteredCurriculum.find((c) => String(c.curriculum_id) === String(selectedCurriculum)) || null}
                  onChange={(event, selected) => {
                    if (!selected) { setSelectedCurriculum(""); return; }
                    const availability = availabilityMap[selected.curriculum_id];
                    if (availability?.isFull) { setSnack({ open: true, message: "This course is already FULL.", severity: "error" }); return; }
                    setSelectedCurriculum(selected.curriculum_id);
                  }}
                  isOptionEqualToValue={(option, value) => option.curriculum_id === value.curriculum_id}
                  getOptionDisabled={(option) => availabilityMap[option.curriculum_id]?.isFull}
                  renderOption={(props, option) => {
                    const availability = availabilityMap[option.curriculum_id];
                    const remaining = availability?.remaining ?? 0;
                    const isFull = availability?.isFull;
                    return (
                      <li {...props} style={{ color: isFull ? "red" : "green", fontSize: isMobile ? "13px" : "14px" }}>
                        {`(${option.program_code}): ${option.program_description}${option.major ? ` (${option.major})` : ""} (${getBranchLabel(option.components)})`}
                        {isFull ? " — FULL (0 slots left)" : ` — (${remaining} slots left)`}
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField {...params} required placeholder="Select Curriculum / Course"
                      error={!!errors.selectedCurriculum}
                      helperText={errors.selectedCurriculum ? "This field is required" : ""}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          height: inputH, fontSize: "16px",
                          "& fieldset": { border: errors.selectedCurriculum ? "2px solid red" : "2px solid black" },
                          "&:hover fieldset": { border: errors.selectedCurriculum ? "2px solid red" : "2px solid black" },
                          "&.Mui-focused fieldset": { border: errors.selectedCurriculum ? "2px solid red" : "2px solid black" },
                        },
                      }}
                    />
                  )}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", margin: "1.2rem 0" }}>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
                <span style={{ margin: "0 0.8rem", fontWeight: "600", color: "#555", fontSize: isMobile ? "13px" : "14px", whiteSpace: "nowrap" }}>Account Information</span>
                <div style={{ flex: 1, height: "1px", backgroundColor: "#ccc" }} />
              </div>

              <div className="TextField" style={{ position: "relative" }}>
                <label style={{ color: "black" }}>Email Address<span style={{ color: "red" }}> *</span></label>
                <input
                  required
                  type="email"
                  disabled={fieldDisabled}
                  className="border"
                  id="email"
                  name="email"
                  placeholder="Enter your email address"
                  value={usersData.email}
                  onChange={(e) => {
                    handleChanges(e);
                    setEmailDomainStatus(null);
                    setEmailDomainSuggestion(null);
                  }}
                  onBlur={handleEmailBlur}
                  onKeyDown={handleKeyDownRegister}
                  style={{
                    paddingLeft: "2.5rem",
                    height: inputH, fontSize: "16px",
                    border: errors.email || emailDomainStatus === "invalid" ? "2px solid red" : "2px solid black",
                  }}
                />
                <EmailIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem", color: "rgba(0,0,0,0.4)", fontSize: "20px" }} />
                {errors.email && <span style={{ color: "red", fontSize: "12px" }}>This field is required</span>}
                {emailDomainStatus === "checking" && (
                  <span style={{ fontSize: "12px", color: "#888", marginTop: "4px", display: "block" }}>
                    Checking email domain…
                  </span>
                )}
                {emailDomainStatus === "invalid" && (
                  <span style={{ fontSize: "12.5px", color: "#c62828", marginTop: "4px", display: "block", fontWeight: 600 }}>
                    ⚠️ This domain doesn't appear to accept email. Please check for typos.
                  </span>
                )}
                {emailDomainSuggestion && (
                  <span style={{ fontSize: "12.5px", color: "#b36b00", marginTop: "4px", display: "block" }}>
                    Did you mean{" "}
                    <button
                      type="button"
                      onClick={() => {
                        const at = usersData.email.lastIndexOf("@");
                        const fixed = usersData.email.slice(0, at + 1) + emailDomainSuggestion;
                        setUserData((prev) => ({ ...prev, email: fixed }));
                        setEmailDomainSuggestion(null);
                        setEmailDomainStatus(null);
                        // re-validate the corrected domain
                        setTimeout(() => handleEmailBlur(), 0);
                      }}
                      style={{ background: "none", border: "none", padding: 0, color: "#1565c0", textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}
                    >
                      {usersData.email.slice(0, usersData.email.lastIndexOf("@") + 1)}{emailDomainSuggestion}
                    </button>
                    ?
                  </span>
                )}
                <span style={{ fontSize: "13px", color: "red", marginTop: "4px", display: "block" }}>
                  Note: Each email can only be used once. Use a valid and unused email address.
                </span>
              </div>

              {/* Bilingual password requirements notice — shown BEFORE the fields
                  so applicants get familiar with the rule before they start typing */}
              <PasswordRulesNotice
                password={usersData.password}
                isMobile={isMobile}
                mainButtonColor={mainButtonColor}
                showChecklist={passwordTouched}
              />

              <div style={{ display: "flex", gap: "1rem", flexDirection: isMobile ? "column" : "row" }}>
                <div className="TextField" style={{ position: "relative", flex: 1 }}>
                  <label style={{ color: "black" }}>Password<span style={{ color: "red" }}> *</span></label>
                  <input type={showPassword ? "text" : "password"} className="border" id="password" disabled={fieldDisabled}
                    name="password" placeholder="Enter your password" value={usersData.password}
                    onChange={handleChanges}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    onKeyDown={handleKeyDownRegister} required
                    style={{ paddingLeft: "2.5rem", height: inputH, fontSize: "16px", border: errors.password ? "2px solid red" : "2px solid black", width: "100%" }} />
                  <LockIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem", color: "rgba(0,0,0,0.4)", fontSize: "22px" }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", top: "2.5rem", right: "1rem", background: "none", border: "none", cursor: "pointer" }}>
                    {showPassword ? <Visibility /> : <VisibilityOff />}
                  </button>
                  {errors.passwordRules && (
                    <span style={{ color: "red", fontSize: "12px" }}>
                      Password does not meet all requirements
                    </span>
                  )}
                  {!errors.passwordRules && errors.password && (
                    <span style={{ color: "red", fontSize: "12px" }}>This field is required</span>
                  )}
                </div>

                <div className="TextField" style={{ position: "relative", flex: 1 }}>
                  <label style={{ color: "black" }}>Confirm Password<span style={{ color: "red" }}> *</span></label>
                  <input type={showConfirmPassword ? "text" : "password"} className="border" id="confirmPassword"
                    name="confirmPassword" placeholder="Re-enter your password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={handleKeyDownRegister}
                    required disabled={!usersData.password}
                    style={{
                      paddingLeft: "2.5rem", height: inputH, fontSize: "16px",
                      border: errors.confirmPassword ? "2px solid red" : "2px solid black",
                      width: "100%",
                      backgroundColor: !usersData.password ? "#f0f0f0" : "white",
                      cursor: !usersData.password ? "not-allowed" : "text",
                    }} />
                  <LockIcon style={{ position: "absolute", top: "2.5rem", left: "0.7rem", color: "rgba(0,0,0,0.4)", fontSize: "22px" }} />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ position: "absolute", top: "2.5rem", right: "1rem", background: "none", border: "none", cursor: "pointer" }}>
                    {showConfirmPassword ? <Visibility /> : <VisibilityOff />}
                  </button>
                  {errors.confirmPassword && <span style={{ color: "red", fontSize: "12px" }}>Passwords do not match</span>}
                </div>
              </div>

              {/* Google Authenticator notice */}
              <Box sx={{
                display: "flex", gap: 1.5, alignItems: "flex-start",
                bgcolor: "#f0f7ff", border: "1px solid #b3d4ff",
                borderRadius: "10px", p: 1.5, mt: 2,
              }}>
                <PhoneAndroidIcon sx={{ color: "#1565c0", fontSize: 20, flexShrink: 0, mt: 0.2 }} />
                <Box>
                  <Typography fontSize={12.5} color="#1a237e" lineHeight={1.6}>
                    <strong>Two-factor authentication required.</strong> After clicking Submit, you will be asked to scan a QR code using <strong>Google Authenticator</strong> on your phone. Please have it ready.
                  </Typography>

                </Box>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
                <FormControlLabel
                  control={<Checkbox checked={reminderChecked} onChange={(e) => setReminderChecked(e.target.checked)} />}
                  label={
                    <Typography sx={{ fontSize: isMobile ? "12px" : "14px" }}>
                      I have read and agree to the admission requirements and policies of {settings?.company_name || ""} before proceeding.
                    </Typography>
                  }
                />
              </Box>

              <div
                tabIndex={0}
                onClick={() => {
                  if (!branchSelected) { setSnack({ open: true, message: "Please select a branch first!", severity: "warning" }); return; }
                  if (!registrationOpen) { setSnack({ open: true, message: "Registration is currently closed for this campus.", severity: "error" }); return; }
                  if (!reminderChecked) { setSnack({ open: true, message: "Please agree to the Terms and Conditions before registering.", severity: "warning" }); return; }
                  if (emailDomainSuggestion || emailDomainStatus === "invalid") {
                    setSnack({ open: true, message: "Please correct the email address typo before submitting.", severity: "warning" });
                    return;
                  }
                  if (!isSubmitting) handleRegister();
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  if (!branchSelected) { setSnack({ open: true, message: "Please select a branch first!", severity: "warning" }); return; }
                  if (!registrationOpen) { setSnack({ open: true, message: "Registration is currently closed for this campus.", severity: "error" }); return; }
                  if (!reminderChecked) { setSnack({ open: true, message: "Please agree to the Terms and Conditions before registering.", severity: "warning" }); return; }
                  if (emailDomainSuggestion || emailDomainStatus === "invalid") {
                    setSnack({ open: true, message: "Please correct the email address typo before submitting.", severity: "warning" });
                    return;
                  }
                  if (!isSubmitting) handleRegister();
                }}
                style={{
                  opacity: reminderChecked && registrationOpen && branchSelected && !emailDomainSuggestion && emailDomainStatus !== "invalid" ? 1 : 0.5,
                  cursor: !reminderChecked || emailDomainSuggestion || emailDomainStatus === "invalid" ? "not-allowed" : "pointer",
                  marginTop: isMobile ? "24px" : "40px",
                  backgroundColor: mainButtonColor,
                  height: "50px",
                  border: "2px solid black",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "16px",
                }}
              >
                {!registrationOpen
                  ? "REGISTRATION CLOSED"
                  : !reminderChecked
                    ? "AGREE TO TERMS TO CONTINUE"
                    : emailDomainSuggestion || emailDomainStatus === "invalid"
                      ? "FIX EMAIL TO CONTINUE"
                      : isSubmitting
                        ? "VALIDATING..."
                        : "SUBMIT APPLICATION"}
              </div>

              <div className="LinkContainer RegistrationLink" style={{ margin: "0.1rem 0rem", fontSize: isMobile ? "13px" : undefined }}>
                <p>Already Have an Account?</p>
                <span><Link to={"/login_applicant"}>Sign In here</Link></span>
              </div>
            </div>

            <div className="Footer">
              <div className="FooterText">
                &copy; {currentYear} {settings?.company_name || ""} <br />
                Academic Information System. <br />
                All rights reserved.
              </div>
            </div>
          </div>
        </Container>

        {/* ── TOTP Setup Modal (replaces old email OTP modal) ── */}
        <TotpSetupModal
          open={showTotpModal}
          onClose={() => setShowTotpModal(false)}
          onSuccess={handleTotpSuccess}
          email={tempEmail}
          mainButtonColor={mainButtonColor}
          isMobile={isCompact}
          registrationPayload={registrationPayload}
        />

        <Snackbar open={snack.open} autoHideDuration={4000} onClose={handleClose} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
          <Alert severity={snack.severity} onClose={handleClose} sx={{ width: "100%" }}>{snack.message}</Alert>
        </Snackbar>

        {/* Dialog: Important Reminder */}
        <Dialog open={openReminder} onClose={() => setOpenReminder(false)} maxWidth="sm" fullWidth
          PaperProps={{ sx: { borderRadius: "16px", overflow: "hidden", mx: isMobile ? 2 : "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" } }}>
          <DialogTitle sx={{ bgcolor: mainButtonColor, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold", px: 3, py: 2 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box sx={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <WarningAmberIcon sx={{ color: "white", fontSize: 22 }} />
              </Box>
              <Box>
                <Typography fontWeight="bold" fontSize={isMobile ? 14 : 16} color="white" lineHeight={1.2}>Important Reminder for Applicants</Typography>
                <Typography fontSize={12} color="rgba(255,255,255,0.8)" lineHeight={1.2}>Please read before proceeding</Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
            <Box sx={{ border: "1px solid #f5a623", borderRadius: "8px", p: 1.5, mb: 2, mt: 2, display: "flex", gap: 1, alignItems: "flex-start", backgroundColor: "#fffbf2" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <Typography fontSize={12.5} color="#5d4037" lineHeight={1.5}>
                Please ensure all information is accurate and complete. Submitting{" "}
                <strong>multiple accounts or duplicate applications is strictly prohibited</strong>{" "}
                and may result in automatic disqualification.
              </Typography>
            </Box>
            <Typography sx={{ fontSize: "13.5px", color: "#333", lineHeight: 1.6, mb: 2 }}>
              Each applicant must register and submit only one application. Await the official announcement for screening results.
            </Typography>
            <Box component="label" htmlFor="agreeCheck" sx={{ display: "flex", alignItems: "center", gap: 1.5, border: "1.5px solid #cc3333", borderRadius: "4px", px: 1.5, py: 1.25, mt: 2, mb: 0.5, cursor: "pointer", transition: "background 0.15s" }}>
              <Checkbox id="agreeCheck" checked={agreeChecked} onChange={(e) => setAgreeChecked(e.target.checked)}
                sx={{ p: 0, color: "#cc3333", "&.Mui-checked": { color: "#cc3333" } }} size="small" />
              <Typography sx={{ fontSize: "13px", color: "#333", userSelect: "none" }}>I understand and agree to submit only one application.</Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ justifyContent: "center", px: 3, pb: 2.5, pt: 1, mt: 1 }}>
            <Button variant="contained" disabled={!agreeChecked} onClick={() => setOpenReminder(false)}
              fullWidth={isMobile}
              sx={{ backgroundColor: agreeChecked ? mainButtonColor : "#b0b8c8", color: "#fff", fontWeight: 600, fontSize: "14px", px: 4, py: 1.25, textTransform: "none", boxShadow: "none", "&:hover": { backgroundColor: agreeChecked ? mainButtonColor : "#b0b8c8", boxShadow: "none" }, "&.Mui-disabled": { backgroundColor: "#b0b8c8", color: "#fff", opacity: 0.7 } }}>
              I Agree — Continue to Registration
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog: Registration Closed */}
        <Dialog open={openClosedDialog} maxWidth="sm" fullWidth
          PaperProps={{ sx: { borderRadius: "16px", overflow: "hidden", mx: isMobile ? 2 : "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" } }}>
          <DialogTitle sx={{ bgcolor: "#7a0000", color: "white", display: "flex", alignItems: "center", fontWeight: "bold", px: 3, py: 2 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box sx={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography fontSize={20}>🚫</Typography>
              </Box>
              <Box>
                <Typography fontWeight="bold" fontSize={isMobile ? 14 : 16} color="white" lineHeight={1.2}>Registration Closed</Typography>
                <Typography fontSize={12} color="rgba(255,255,255,0.8)" lineHeight={1.2}>Applications are not being accepted</Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
            <Box textAlign="center" py={1}>
              <Box sx={{ width: 80, height: 80, borderRadius: "50%", backgroundColor: "#fff0f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", border: "3px solid #f44336" }}>
                <Typography fontSize={34}>🚫</Typography>
              </Box>
              <Typography fontWeight="bold" fontSize={17} color="#c62828" mb={1}>Registration is Currently Closed</Typography>
              <Typography fontSize={13.5} color="#555" lineHeight={1.6}>Please wait for the official announcement before attempting to register.</Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ justifyContent: "center", px: 3, pb: 2.5, pt: 1.5 }}>
            <Button variant="contained" onClick={() => navigate("/login_applicant")} fullWidth={isMobile}
              sx={{ backgroundColor: "#7a0000", color: "#fff", fontWeight: 600, fontSize: "14px", px: 4, py: 1.25, borderRadius: "10px", textTransform: "none", boxShadow: "none" }}>
              Go to Login
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog: Branch Admissions Closed */}
        <Dialog open={openBranchDialog} onClose={() => setOpenBranchDialog(false)} maxWidth="sm" fullWidth
          PaperProps={{ sx: { borderRadius: "16px", overflow: "hidden", mx: isMobile ? 2 : "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.25)" } }}>
          <DialogTitle sx={{ bgcolor: mainButtonColor, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold", px: 3, py: 2 }}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Box sx={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CampaignIcon sx={{ color: "white", fontSize: 22 }} />
              </Box>
              <Box>
                <Typography fontWeight="bold" fontSize={isMobile ? 14 : 16} color="white" lineHeight={1.2}>Admissions Currently Closed</Typography>
                <Typography fontSize={12} color="rgba(255,255,255,0.8)" lineHeight={1.2}>This campus is not accepting applications</Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
            <Box sx={{ border: "1px solid #f5a623", borderRadius: "8px", p: 1.5, mb: 2, mt: 2, display: "flex", gap: 1, alignItems: "flex-start", backgroundColor: "#fffbf2" }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <Typography fontSize={12.5} color="#5d4037" lineHeight={1.5}>
                Registration is only available during the officially designated hours. Submissions outside this period <strong>cannot be processed</strong>.
              </Typography>
            </Box>
            <Typography sx={{ fontSize: "13.5px", color: "#333", lineHeight: 1.6, mb: 1.5 }}>
              Kindly return during the authorized registration hours to complete your application.
            </Typography>
            {selectedBranch?.start_date && selectedBranch?.end_date && (
              <Box sx={{ textAlign: "center", mt: 2, p: 2, background: "#fff9ec", borderRadius: "8px", border: "1.5px solid #e2e8f0" }}>
                <Typography sx={{ fontSize: "11px", color: "red", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, mb: 0.5 }}>Registration Hours</Typography>
                <Typography sx={{ fontSize: isMobile ? "20px" : "26px", fontWeight: 700, color: "#1a1a2e", fontFamily: "'DM Sans', sans-serif" }}>
                  {new Date(selectedBranch.start_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" })}
                  {" – "}
                  {new Date(selectedBranch.end_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Manila" })}
                </Typography>
              </Box>
            )}
            <Typography sx={{ fontSize: "13px", color: "#888", lineHeight: 1.6, textAlign: "center", fontStyle: "italic", mt: 2, mb: 0.5 }}>
              We sincerely appreciate your patience and understanding.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1.5, display: "flex", flexDirection: isMobile ? "column" : "row" }}>
            <Button variant="outlined" color="error" onClick={() => setOpenBranchDialog(false)} fullWidth sx={{ height: 48, textTransform: "none", fontWeight: 600, fontSize: "14px" }}>Close</Button>
            <Button variant="contained" onClick={() => navigate("/login_applicant")} fullWidth sx={{ height: 48, backgroundColor: mainButtonColor, color: "#fff", fontWeight: 600, fontSize: "14px", textTransform: "none", boxShadow: "none" }}>Go to Login</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
};

export default Register;
