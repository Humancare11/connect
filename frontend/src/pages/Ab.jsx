import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./AppointmentBooking.css";
import api from "../api";
import HealthcareIcon from "../components/HealthcareIcon";

// --- Search helpers ---------------------------------------------------------
// Plain `.includes()` matches a query ANYWHERE inside a string, including
// mid-word - e.g. searching "men" would match "Manage**men**t" or "Women's".
// matchQuery() instead matches only at word boundaries (start of a word),
// so "men" matches "Men's Health", "Mental Health", "Menstrual Cramps"
// but NOT "Weight Management" or "Women's Health".
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchQuery(text, q) {
  if (!q) return true;
  if (!text) return false;
  const re = new RegExp(`\\b${escapeRegExp(q)}`, "i");
  return re.test(text);
}

// Convert the database-owned appointment tree into the shape this UI already uses.
function normalizeAppointmentTree(tree) {
  return (Array.isArray(tree) ? tree : []).map((category) => ({
    id: category._id,
    icon: category.icon || "stethoscope",
    label: category.name || "Untitled Category",
    description: category.description || "",
    price: Number.isFinite(Number(category.price)) ? Number(category.price) : 0,
    currency: category.currency || "USD",
    specialties: (Array.isArray(category.specialties) ? category.specialties : []).map((specialty) => ({
      id: specialty._id,
      name: specialty.name || "Untitled Specialty",
      icon: specialty.icon || "stethoscope",
      description: specialty.description || "",
      conditions: (Array.isArray(specialty.conditions) ? specialty.conditions : []).map((condition) => [
        condition.name || "Untitled Condition",
        condition.icon || "stethoscope",
        condition._id,
        condition.description || "",
      ]),
    })),
  }));
}
// Build flat helpers from the price-enriched tree. `label`, `cost`, and
// `currency` all originate from the API (attached in enrichedTree).
function buildFlatHelpers(tree) {
  const specialties = [];
  const conditions = [];
  tree.forEach((cat) =>
    cat.specialties.forEach((s) => {
      specialties.push({ ...s, catId: cat.id, catLabel: cat.label });
      s.conditions.forEach(([name, icon]) =>
        conditions.push({
          name,
          icon,
          to: s.name,
          catId: cat.id,
          catLabel: cat.label,
          cost: s.cost,
          currency: s.currency,
          priceAvailable: s.priceAvailable,
          priceMessage: s.priceMessage,
        }),
      );
    }),
  );
  return { specialties, conditions };
}

// --- Time slots ---------------------------------------------------------------
const ALL_TIME_SLOTS = [
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
  "7:30 PM",
];

function isSlotPassed(dateStr, slot) {
  const today = new Date().toISOString().split("T")[0];
  if (dateStr !== today) return false;
  const now = new Date();
  const [time, ampm] = slot.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// --- Breadcrumb ---------------------------------------------------------------
function Breadcrumb({ items, onNavigate }) {
  return (
    <div className="hcc-breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="hcc-bc-item">
          {i > 0 && <span className="hcc-bc-sep">&gt;</span>}
          {i < items.length - 1 ? (
            <button className="hcc-bc-link" onClick={() => onNavigate(i)}>
              {item}
            </button>
          ) : (
            <span className="hcc-bc-current">{item}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// --- Main Component -----------------------------------------------------------
export default function Ab() {
  const navigate = useNavigate();
  const [appointmentTree, setAppointmentTree] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState("");
  const [drillLevel, setDrillLevel] = useState("cat");
  const [activeCat, setActiveCat] = useState(null);
  const [activeSpec, setActiveSpec] = useState(null);
  const [browseTab, setBrowseTab] = useState(null);
  const [query, setQuery] = useState("");

  const fetchAppointmentTree = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setTreeLoading(true);
    try {
      const res = await api.get("/api/appointment-tree");
      setAppointmentTree(normalizeAppointmentTree(res.data));
      setTreeError("");
    } catch (err) {
      setTreeError(err.response?.data?.msg || "Unable to load healthcare categories.");
    } finally {
      if (!silent) setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointmentTree();
  }, [fetchAppointmentTree]);

  useEffect(() => {
    const refresh = () => fetchAppointmentTree({ silent: true });
    const intervalId = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
    };
  }, [fetchAppointmentTree]);

  // Category, specialty, condition, and pricing data comes only from /api/appointment-tree.
  const enrichedTree = useMemo(() => {
    return appointmentTree.map((cat) => {
      const price = Number(cat.price);
      const priceAvailable = Number.isFinite(price) && price > 0;
      return {
        ...cat,
        currency: "USD",
        specialties: cat.specialties.map((specialty) => ({
          ...specialty,
          cost: priceAvailable ? price : undefined,
          currency: "USD",
          priceAvailable,
          priceMessage: "No valid database price is configured for this category.",
        })),
      };
    });
  }, [appointmentTree]);

  useEffect(() => {
    if (!activeCat) return;
    const refreshedCat = enrichedTree.find((cat) => cat.id === activeCat.id);
    if (!refreshedCat) {
      setActiveCat(null);
      setActiveSpec(null);
      setDrillLevel("cat");
      return;
    }
    setActiveCat(refreshedCat);
    if (activeSpec) {
      const refreshedSpec = refreshedCat.specialties.find((spec) => spec.id === activeSpec.id);
      if (refreshedSpec) {
        setActiveSpec({ ...refreshedSpec, catId: refreshedCat.id, catLabel: refreshedCat.label });
      } else {
        setActiveSpec(null);
        setDrillLevel("spec");
      }
    }
  }, [enrichedTree, activeCat?.id, activeSpec?.id]);

  const { specialties: flatSpecialties, conditions: flatConditions } = useMemo(
    () => buildFlatHelpers(enrichedTree),
    [enrichedTree],
  );

  const tabs = [
    { id: "cat", num: "01", label: "Categories" },
    { id: "spec", num: "02", label: "Specialties" },
    { id: "cond", num: "03", label: "Conditions" },
  ];

  const activeTabId = browseTab ?? drillLevel;

  const q = query.trim().toLowerCase();

  const visibleFlatSpecialties = useMemo(
    () => flatSpecialties.filter((s) => !q || s.name.toLowerCase().includes(q)),
    [q, flatSpecialties],
  );
  const visibleFlatConditions = useMemo(
    () => flatConditions.filter((c) => !q || c.name.toLowerCase().includes(q) || c.to.toLowerCase().includes(q)),
    [q, flatConditions],
  );
  const visibleCats = useMemo(
    () => enrichedTree.filter((c) => !q || c.label?.toLowerCase().includes(q) || c.specialties.some((s) => s.name.toLowerCase().includes(q))),
    [q, enrichedTree],
  );

  const handleTabSwitch = (tabId) => {
    if (tabId === "cat") {
      setBrowseTab(null);
      setDrillLevel("cat");
      setActiveCat(null);
      setActiveSpec(null);
    } else if (tabId === "spec") {
      setBrowseTab("spec");
    } else {
      setBrowseTab("cond");
    }
    setQuery("");
  };

  const handleOpenCat = (cat) => {
    setBrowseTab(null);
    setActiveCat(cat);
    setDrillLevel("spec");
    setQuery("");
  };

  const handleOpenSpec = (specialty) => {
    setBrowseTab(null);
    setActiveSpec(specialty);
    setDrillLevel("cond");
    setQuery("");
  };

  const handleSelectCond = (condName, condIcon, specialty) => {
    navigate("/appointment-booking/form", {
      state: {
        selection: {
          specName: specialty.name,
          specIco: specialty.icon,               // payload key kept for the booking form contract
          catId: specialty.catId,
          catLabel: specialty.catLabel,
          cost: specialty.cost,
          currency: specialty.currency ?? "USD", // dynamic currency for booking form
          condName,
          condIco: condIcon,                     // payload key kept for the booking form contract
        },
      },
    });
  };

  const handleFlatCondClick = (condition) => {
    const specialty = flatSpecialties.find((s) => s.name === condition.to && s.catId === condition.catId);
    if (specialty) handleSelectCond(condition.name, condition.icon, specialty);
  };

  const handleFlatSpecClick = (specialty) => {
    const cat = enrichedTree.find((c) => c.id === specialty.catId);
    setBrowseTab(null);
    setActiveCat(cat);
    setActiveSpec(specialty);
    setDrillLevel("cond");
    setQuery("");
  };

  const handleBreadcrumb = (idx) => {
    if (idx === 0) {
      setDrillLevel("cat");
      setActiveCat(null);
      setActiveSpec(null);
    }
    if (idx === 1) {
      setDrillLevel("spec");
      setActiveSpec(null);
    }
  };

  const handleCardClick = (e, action) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    action();
  };

  const breadcrumbItems = ["All Categories"];
  if (activeCat) breadcrumbItems.push(activeCat.label);
  if (activeSpec) breadcrumbItems.push(activeSpec.name);

  const searchPlaceholder =
    activeTabId === "cat"
      ? "Search categories..."
      : activeTabId === "spec"
        ? "Search specialties..."
        : "Search conditions / symptoms...";

  const drillConditions = activeSpec ? activeSpec.conditions : [];

  const activeCatIndex = activeCat
    ? enrichedTree.findIndex((c) => c.id === activeCat.id)
    : -1;
  const catNumLabel =
    activeCatIndex >= 0 ? String(activeCatIndex + 1).padStart(2, "0") : null;

  return (
    <section className="hcc-sx">
      <div className="wrap">
        {/* -- CENTERED HERO -- */}
        <div className="head">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Discover Care
          </span>

          <h2>Find the right online doctor for your needs.</h2>

          <p className="lead">
            Book an online doctor appointment in minutes and access secure
            virtual healthcare services without long wait times or unnecessary
            clinic visits.
          </p>
        </div>

        <div className="top-controls">
          {/* -- NUMBERED TAB BAR -- */}
          <div className="tab-bar-wrap">
            <div className="switch">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  data-tab={t.id}
                  className={activeTabId === t.id ? "active" : ""}
                  onClick={() => handleTabSwitch(t.id)}
                >
                  <span className="tab-num">{t.num}</span>
                  <span className="tab-label">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* -- SEARCH TOOLBAR -- */}
          <div className="toolbar">
            <div className="search">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                autoComplete="off"
              />
            </div>
          </div>
        </div>
        {/* -- CONTENT CARD (white rounded container) -- */}
        <div className="content-card">

          {/* -- DRILL MODE -- */}
          {!browseTab && (
            <>
              {drillLevel !== "cat" && (
                <div style={{ padding: "28px 40px 0" }}>
                  <Breadcrumb
                    items={breadcrumbItems}
                    onNavigate={handleBreadcrumb}
                  />
                </div>
              )}

              {/* -- Category grid -- */}
              {drillLevel === "cat" && (
                <div className="panel">
                  <div className="catgrid">
                    {visibleCats.length ? (
                      visibleCats.map((c) => {
                        const specialtyCount = c.specialties.length;
                        const conditionCount = c.specialties.reduce((n, s) => n + s.conditions.length, 0);
                        const description = c.description || "No description added yet.";
                        return (
                          <div
                            key={c.id}
                            className="catcard"
                            onClick={(e) =>
                              handleCardClick(e, () => handleOpenCat(c))
                            }
                          >
                            <div className="ic">
                              <HealthcareIcon name={c.icon} size={30} />
                            </div>
                            <h3>{c.label}</h3>
                            <div className="meta">{specialtyCount} specialties - {conditionCount} conditions</div>
                            <div className="samp">{description}</div>
                            <div className="go">Explore → </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="empty">
                        <div className="big">Search</div>
                        {treeLoading
                          ? "Loading categories..."
                          : treeError || "No categories match."}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* -- Specialty list -- */}
              {drillLevel === "spec" && activeCat && (
                <div className="panel">
                  <div className="hcc-level-label">
                    {catNumLabel && <>{catNumLabel} -</>}
                    <span style={{ fontSize: 20 }}>
                      <HealthcareIcon name={activeCat.icon} size={20} />
                    </span>
                    {activeCat.label}
                  </div>
                  <div className="grid">
                    {activeCat.specialties
                      .filter((s) => !q || s.name.toLowerCase().includes(q))
                      .map((s) => {
                        const specialtyWithCat = { ...s, catId: activeCat.id, catLabel: activeCat.label };
                        return (
                          <div
                            key={s.id || s.name}
                            className="spec"
                            onClick={(e) => handleCardClick(e, () => handleOpenSpec(specialtyWithCat))}
                          >
                            <div className="ic">
                              <HealthcareIcon name={s.icon} size={30} />
                            </div>
                            <h3>{s.name}</h3>
                            <div className="spec-desc">{s.description || "No description added yet."}</div>
                            <div className="spec-footer">
  <div className="count">{s.conditions.length} conditions</div>
  <div className="book-link">Book →</div>
</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* -- Condition list -- (unchanged) -- */}
              {drillLevel === "cond" && activeSpec && (
                <div className="panel">
                  <div className="hcc-level-label">
                    <span style={{ fontSize: 20 }}>
                      <HealthcareIcon name={activeSpec.icon} size={20} />
                    </span>
                    {activeSpec.name} - select your condition
                  </div>
                  {/* {!activeSpec.priceAvailable && (
                    <div className="hcc-price-alert">
                      {activeSpec.priceMessage}
                    </div>
                  )} */}
                  <div className="condgrid">
                    {drillConditions
                      .filter(([name]) => !q || name.toLowerCase().includes(q))
                      .map(([name, icon]) => (
                        <div
                          key={name}
                          className="condcard"
                          onClick={(e) => handleCardClick(e, () => handleSelectCond(name, icon, activeSpec))}
                        >
                          <div className="condcard-ico">
                            <HealthcareIcon name={icon} size={23} />
                          </div>
                          <div className="condcard-name">{name}</div>
                          <div className="condcard-go">Book -&gt;</div>
                        </div>
                      ))}
                    <div
                      className={`condcard condcard-other${!activeSpec.priceAvailable ? " condcard--disabled" : ""}`}
                      onClick={(e) =>
                        handleCardClick(e, () =>
                          handleSelectCond(
                            "General Consultation",
                            "stethoscope",
                            activeSpec,
                          ),
                        )
                      }
                    >
                      <div className="condcard-ico">
                        <HealthcareIcon name="stethoscope" size={23} />
                      </div>
                      <div className="condcard-body">
                        <div className="condcard-name">Other / not listed</div>
                        <div className="condcard-desc">{activeSpec.name}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* -- FLAT BROWSE: Specialties -- */}
          {browseTab === "spec" && (
            <div className="panel">
              <div className="grid">
                {visibleFlatSpecialties.length ? (
                  visibleFlatSpecialties.map((s) => (
                    <div
                      key={(s.id || s.name) + s.catId}
                      className="spec"
                      onClick={(e) => handleCardClick(e, () => handleFlatSpecClick(s))}
                    >
                      <div className="ic">
                        <HealthcareIcon name={s.icon} size={30} />
                      </div>
                      <h3>{s.name}</h3>
                      <div className="spec-desc">{s.description || "No description added yet."}</div>
                      <div className="count">{s.conditions.length} conditions</div>
                      <button type="button" className="spec-book-btn">
                        Book Now
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    <div className="big">Search</div>No specialties found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -- FLAT BROWSE: Conditions -- (unchanged) -- */}
          {browseTab === "cond" && (
            <div className="panel">
              <div className="condgrid">
                {visibleFlatConditions.length ? (
                  visibleFlatConditions.map((c, i) => (
                    <div
                      key={i}
                      className={`condcard${!c.priceAvailable ? " condcard--disabled" : ""}`}
                      onClick={(e) =>
                        handleCardClick(e, () => handleFlatCondClick(c))
                      }
                    >
                      <div className="condcard-ico">
                        <HealthcareIcon name={c.icon} size={23} />
                      </div>
                      <div className="condcard-name">{c.name}</div>
                      <div className="condcard-spec">{c.to}</div>
  <div className="book-link">Book →</div>
                    </div>
                  ))
                ) : (
                  <div className="empty">
                    <div className="big">Search</div>No conditions match.
                  </div>
                )}
              </div>
            </div>
          )}

        </div>{/* /content-card */}

      </div>
    </section>
  );
}

