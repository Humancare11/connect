import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── Flag emoji from ISO-3166-1 alpha-2 code ─────────────────────────────────
export const toFlag = (iso2) =>
  [...iso2.toUpperCase()].map(c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  ).join("");

// ─── Comprehensive country data ───────────────────────────────────────────────
export const COUNTRIES = [
  { code: "AC", dial: "247",  name: "Ascension Island" },
  { code: "AD", dial: "376",  name: "Andorra" },
  { code: "AE", dial: "971",  name: "United Arab Emirates" },
  { code: "AF", dial: "93",   name: "Afghanistan" },
  { code: "AG", dial: "1268", name: "Antigua & Barbuda" },
  { code: "AI", dial: "1264", name: "Anguilla" },
  { code: "AL", dial: "355",  name: "Albania" },
  { code: "AM", dial: "374",  name: "Armenia" },
  { code: "AO", dial: "244",  name: "Angola" },
  { code: "AR", dial: "54",   name: "Argentina" },
  { code: "AS", dial: "1684", name: "American Samoa" },
  { code: "AT", dial: "43",   name: "Austria" },
  { code: "AU", dial: "61",   name: "Australia" },
  { code: "AW", dial: "297",  name: "Aruba" },
  { code: "AZ", dial: "994",  name: "Azerbaijan" },
  { code: "BA", dial: "387",  name: "Bosnia & Herzegovina" },
  { code: "BB", dial: "1246", name: "Barbados" },
  { code: "BD", dial: "880",  name: "Bangladesh" },
  { code: "BE", dial: "32",   name: "Belgium" },
  { code: "BF", dial: "226",  name: "Burkina Faso" },
  { code: "BG", dial: "359",  name: "Bulgaria" },
  { code: "BH", dial: "973",  name: "Bahrain" },
  { code: "BI", dial: "257",  name: "Burundi" },
  { code: "BJ", dial: "229",  name: "Benin" },
  { code: "BL", dial: "590",  name: "St. Barthélemy" },
  { code: "BM", dial: "1441", name: "Bermuda" },
  { code: "BN", dial: "673",  name: "Brunei" },
  { code: "BO", dial: "591",  name: "Bolivia" },
  { code: "BQ", dial: "599",  name: "Caribbean Netherlands" },
  { code: "BR", dial: "55",   name: "Brazil" },
  { code: "BS", dial: "1242", name: "Bahamas" },
  { code: "BT", dial: "975",  name: "Bhutan" },
  { code: "BW", dial: "267",  name: "Botswana" },
  { code: "BY", dial: "375",  name: "Belarus" },
  { code: "BZ", dial: "501",  name: "Belize" },
  { code: "CA", dial: "1",    name: "Canada" },
  { code: "CC", dial: "61",   name: "Cocos Islands" },
  { code: "CD", dial: "243",  name: "Congo (DRC)" },
  { code: "CF", dial: "236",  name: "Central African Republic" },
  { code: "CG", dial: "242",  name: "Congo (Republic)" },
  { code: "CH", dial: "41",   name: "Switzerland" },
  { code: "CI", dial: "225",  name: "Côte d'Ivoire" },
  { code: "CK", dial: "682",  name: "Cook Islands" },
  { code: "CL", dial: "56",   name: "Chile" },
  { code: "CM", dial: "237",  name: "Cameroon" },
  { code: "CN", dial: "86",   name: "China" },
  { code: "CO", dial: "57",   name: "Colombia" },
  { code: "CR", dial: "506",  name: "Costa Rica" },
  { code: "CU", dial: "53",   name: "Cuba" },
  { code: "CV", dial: "238",  name: "Cape Verde" },
  { code: "CW", dial: "599",  name: "Curaçao" },
  { code: "CX", dial: "61",   name: "Christmas Island" },
  { code: "CY", dial: "357",  name: "Cyprus" },
  { code: "CZ", dial: "420",  name: "Czech Republic" },
  { code: "DE", dial: "49",   name: "Germany" },
  { code: "DJ", dial: "253",  name: "Djibouti" },
  { code: "DK", dial: "45",   name: "Denmark" },
  { code: "DM", dial: "1767", name: "Dominica" },
  { code: "DO", dial: "1809", name: "Dominican Republic" },
  { code: "DZ", dial: "213",  name: "Algeria" },
  { code: "EC", dial: "593",  name: "Ecuador" },
  { code: "EE", dial: "372",  name: "Estonia" },
  { code: "EG", dial: "20",   name: "Egypt" },
  { code: "ER", dial: "291",  name: "Eritrea" },
  { code: "ES", dial: "34",   name: "Spain" },
  { code: "ET", dial: "251",  name: "Ethiopia" },
  { code: "FI", dial: "358",  name: "Finland" },
  { code: "FJ", dial: "679",  name: "Fiji" },
  { code: "FK", dial: "500",  name: "Falkland Islands" },
  { code: "FM", dial: "691",  name: "Micronesia" },
  { code: "FO", dial: "298",  name: "Faroe Islands" },
  { code: "FR", dial: "33",   name: "France" },
  { code: "GA", dial: "241",  name: "Gabon" },
  { code: "GB", dial: "44",   name: "United Kingdom" },
  { code: "GD", dial: "1473", name: "Grenada" },
  { code: "GE", dial: "995",  name: "Georgia" },
  { code: "GF", dial: "594",  name: "French Guiana" },
  { code: "GG", dial: "44",   name: "Guernsey" },
  { code: "GH", dial: "233",  name: "Ghana" },
  { code: "GI", dial: "350",  name: "Gibraltar" },
  { code: "GL", dial: "299",  name: "Greenland" },
  { code: "GM", dial: "220",  name: "Gambia" },
  { code: "GN", dial: "224",  name: "Guinea" },
  { code: "GP", dial: "590",  name: "Guadeloupe" },
  { code: "GQ", dial: "240",  name: "Equatorial Guinea" },
  { code: "GR", dial: "30",   name: "Greece" },
  { code: "GT", dial: "502",  name: "Guatemala" },
  { code: "GU", dial: "1671", name: "Guam" },
  { code: "GW", dial: "245",  name: "Guinea-Bissau" },
  { code: "GY", dial: "592",  name: "Guyana" },
  { code: "HK", dial: "852",  name: "Hong Kong" },
  { code: "HN", dial: "504",  name: "Honduras" },
  { code: "HR", dial: "385",  name: "Croatia" },
  { code: "HT", dial: "509",  name: "Haiti" },
  { code: "HU", dial: "36",   name: "Hungary" },
  { code: "ID", dial: "62",   name: "Indonesia" },
  { code: "IE", dial: "353",  name: "Ireland" },
  { code: "IL", dial: "972",  name: "Israel" },
  { code: "IM", dial: "44",   name: "Isle of Man" },
  { code: "IN", dial: "91",   name: "India" },
  { code: "IO", dial: "246",  name: "British Indian Ocean Territory" },
  { code: "IQ", dial: "964",  name: "Iraq" },
  { code: "IR", dial: "98",   name: "Iran" },
  { code: "IS", dial: "354",  name: "Iceland" },
  { code: "IT", dial: "39",   name: "Italy" },
  { code: "JE", dial: "44",   name: "Jersey" },
  { code: "JM", dial: "1876", name: "Jamaica" },
  { code: "JO", dial: "962",  name: "Jordan" },
  { code: "JP", dial: "81",   name: "Japan" },
  { code: "KE", dial: "254",  name: "Kenya" },
  { code: "KG", dial: "996",  name: "Kyrgyzstan" },
  { code: "KH", dial: "855",  name: "Cambodia" },
  { code: "KI", dial: "686",  name: "Kiribati" },
  { code: "KM", dial: "269",  name: "Comoros" },
  { code: "KN", dial: "1869", name: "St. Kitts & Nevis" },
  { code: "KP", dial: "850",  name: "North Korea" },
  { code: "KR", dial: "82",   name: "South Korea" },
  { code: "KW", dial: "965",  name: "Kuwait" },
  { code: "KY", dial: "1345", name: "Cayman Islands" },
  { code: "KZ", dial: "7",    name: "Kazakhstan" },
  { code: "LA", dial: "856",  name: "Laos" },
  { code: "LB", dial: "961",  name: "Lebanon" },
  { code: "LC", dial: "1758", name: "St. Lucia" },
  { code: "LI", dial: "423",  name: "Liechtenstein" },
  { code: "LK", dial: "94",   name: "Sri Lanka" },
  { code: "LR", dial: "231",  name: "Liberia" },
  { code: "LS", dial: "266",  name: "Lesotho" },
  { code: "LT", dial: "370",  name: "Lithuania" },
  { code: "LU", dial: "352",  name: "Luxembourg" },
  { code: "LV", dial: "371",  name: "Latvia" },
  { code: "LY", dial: "218",  name: "Libya" },
  { code: "MA", dial: "212",  name: "Morocco" },
  { code: "MC", dial: "377",  name: "Monaco" },
  { code: "MD", dial: "373",  name: "Moldova" },
  { code: "ME", dial: "382",  name: "Montenegro" },
  { code: "MF", dial: "590",  name: "St. Martin" },
  { code: "MG", dial: "261",  name: "Madagascar" },
  { code: "MH", dial: "692",  name: "Marshall Islands" },
  { code: "MK", dial: "389",  name: "North Macedonia" },
  { code: "ML", dial: "223",  name: "Mali" },
  { code: "MM", dial: "95",   name: "Myanmar" },
  { code: "MN", dial: "976",  name: "Mongolia" },
  { code: "MO", dial: "853",  name: "Macau" },
  { code: "MP", dial: "1670", name: "Northern Mariana Islands" },
  { code: "MQ", dial: "596",  name: "Martinique" },
  { code: "MR", dial: "222",  name: "Mauritania" },
  { code: "MS", dial: "1664", name: "Montserrat" },
  { code: "MT", dial: "356",  name: "Malta" },
  { code: "MU", dial: "230",  name: "Mauritius" },
  { code: "MV", dial: "960",  name: "Maldives" },
  { code: "MW", dial: "265",  name: "Malawi" },
  { code: "MX", dial: "52",   name: "Mexico" },
  { code: "MY", dial: "60",   name: "Malaysia" },
  { code: "MZ", dial: "258",  name: "Mozambique" },
  { code: "NA", dial: "264",  name: "Namibia" },
  { code: "NC", dial: "687",  name: "New Caledonia" },
  { code: "NE", dial: "227",  name: "Niger" },
  { code: "NF", dial: "672",  name: "Norfolk Island" },
  { code: "NG", dial: "234",  name: "Nigeria" },
  { code: "NI", dial: "505",  name: "Nicaragua" },
  { code: "NL", dial: "31",   name: "Netherlands" },
  { code: "NO", dial: "47",   name: "Norway" },
  { code: "NP", dial: "977",  name: "Nepal" },
  { code: "NR", dial: "674",  name: "Nauru" },
  { code: "NU", dial: "683",  name: "Niue" },
  { code: "NZ", dial: "64",   name: "New Zealand" },
  { code: "OM", dial: "968",  name: "Oman" },
  { code: "PA", dial: "507",  name: "Panama" },
  { code: "PE", dial: "51",   name: "Peru" },
  { code: "PF", dial: "689",  name: "French Polynesia" },
  { code: "PG", dial: "675",  name: "Papua New Guinea" },
  { code: "PH", dial: "63",   name: "Philippines" },
  { code: "PK", dial: "92",   name: "Pakistan" },
  { code: "PL", dial: "48",   name: "Poland" },
  { code: "PM", dial: "508",  name: "St. Pierre & Miquelon" },
  { code: "PR", dial: "1787", name: "Puerto Rico" },
  { code: "PS", dial: "970",  name: "Palestine" },
  { code: "PT", dial: "351",  name: "Portugal" },
  { code: "PW", dial: "680",  name: "Palau" },
  { code: "PY", dial: "595",  name: "Paraguay" },
  { code: "QA", dial: "974",  name: "Qatar" },
  { code: "RE", dial: "262",  name: "Réunion" },
  { code: "RO", dial: "40",   name: "Romania" },
  { code: "RS", dial: "381",  name: "Serbia" },
  { code: "RU", dial: "7",    name: "Russia" },
  { code: "RW", dial: "250",  name: "Rwanda" },
  { code: "SA", dial: "966",  name: "Saudi Arabia" },
  { code: "SB", dial: "677",  name: "Solomon Islands" },
  { code: "SC", dial: "248",  name: "Seychelles" },
  { code: "SD", dial: "249",  name: "Sudan" },
  { code: "SE", dial: "46",   name: "Sweden" },
  { code: "SG", dial: "65",   name: "Singapore" },
  { code: "SH", dial: "290",  name: "St. Helena" },
  { code: "SI", dial: "386",  name: "Slovenia" },
  { code: "SK", dial: "421",  name: "Slovakia" },
  { code: "SL", dial: "232",  name: "Sierra Leone" },
  { code: "SM", dial: "378",  name: "San Marino" },
  { code: "SN", dial: "221",  name: "Senegal" },
  { code: "SO", dial: "252",  name: "Somalia" },
  { code: "SR", dial: "597",  name: "Suriname" },
  { code: "SS", dial: "211",  name: "South Sudan" },
  { code: "ST", dial: "239",  name: "São Tomé & Príncipe" },
  { code: "SV", dial: "503",  name: "El Salvador" },
  { code: "SX", dial: "1721", name: "Sint Maarten" },
  { code: "SY", dial: "963",  name: "Syria" },
  { code: "SZ", dial: "268",  name: "Eswatini" },
  { code: "TC", dial: "1649", name: "Turks & Caicos Islands" },
  { code: "TD", dial: "235",  name: "Chad" },
  { code: "TG", dial: "228",  name: "Togo" },
  { code: "TH", dial: "66",   name: "Thailand" },
  { code: "TJ", dial: "992",  name: "Tajikistan" },
  { code: "TK", dial: "690",  name: "Tokelau" },
  { code: "TL", dial: "670",  name: "Timor-Leste" },
  { code: "TM", dial: "993",  name: "Turkmenistan" },
  { code: "TN", dial: "216",  name: "Tunisia" },
  { code: "TO", dial: "676",  name: "Tonga" },
  { code: "TR", dial: "90",   name: "Turkey" },
  { code: "TT", dial: "1868", name: "Trinidad & Tobago" },
  { code: "TV", dial: "688",  name: "Tuvalu" },
  { code: "TW", dial: "886",  name: "Taiwan" },
  { code: "TZ", dial: "255",  name: "Tanzania" },
  { code: "UA", dial: "380",  name: "Ukraine" },
  { code: "UG", dial: "256",  name: "Uganda" },
  { code: "US", dial: "1",    name: "United States" },
  { code: "UY", dial: "598",  name: "Uruguay" },
  { code: "UZ", dial: "998",  name: "Uzbekistan" },
  { code: "VA", dial: "379",  name: "Vatican City" },
  { code: "VC", dial: "1784", name: "St. Vincent & Grenadines" },
  { code: "VE", dial: "58",   name: "Venezuela" },
  { code: "VG", dial: "1284", name: "British Virgin Islands" },
  { code: "VI", dial: "1340", name: "U.S. Virgin Islands" },
  { code: "VN", dial: "84",   name: "Vietnam" },
  { code: "VU", dial: "678",  name: "Vanuatu" },
  { code: "WF", dial: "681",  name: "Wallis & Futuna" },
  { code: "WS", dial: "685",  name: "Samoa" },
  { code: "XK", dial: "383",  name: "Kosovo" },
  { code: "YE", dial: "967",  name: "Yemen" },
  { code: "YT", dial: "262",  name: "Mayotte" },
  { code: "ZA", dial: "27",   name: "South Africa" },
  { code: "ZM", dial: "260",  name: "Zambia" },
  { code: "ZW", dial: "263",  name: "Zimbabwe" },
];

export function parseValue(val, defaultCode) {
  const fallbackCode = defaultCode && defaultCode !== "auto" ? defaultCode : "IN";
  const def = COUNTRIES.find(c => c.code === fallbackCode.toUpperCase())
    || COUNTRIES.find(c => c.code === "IN");
  if (!val || !val.startsWith("+")) return { country: def, local: val || "" };
  const digits = val.slice(1);
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  const matches = sorted.filter(c => digits.startsWith(c.dial));
  if (matches.length > 0) {
    const matched = matches.length === 1 ? matches[0] : matches.find(c => c.code === "US") || matches[0];
    return { country: matched, local: digits.slice(matched.dial.length) };
  }
  return { country: def, local: digits };
}

const findCountry = (code) =>
  COUNTRIES.find(c => c.code === String(code || "").toUpperCase());

export const findCountryByName = (name) =>
  COUNTRIES.find(c => c.name === String(name || "").trim());

const browserLocaleCountry = () => {
  const candidates = [
    navigator.language,
    ...(navigator.languages || []),
  ].filter(Boolean);

  for (const locale of candidates) {
    try {
      const region = new Intl.Locale(locale).region;
      const country = findCountry(region);
      if (country) return country;
    } catch {
      const region = locale.split("-")[1];
      const country = findCountry(region);
      if (country) return country;
    }
  }
  return null;
};

const detectCountry = async () => {
  const cached = findCountry(localStorage.getItem("hc_phone_country"));
  if (cached) return cached;

  const fromLocale = browserLocaleCountry();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const res = await fetch("https://api.country.is/", { signal: controller.signal });
    const data = await res.json();
    const fromIp = findCountry(data?.country);
    if (fromIp) {
      localStorage.setItem("hc_phone_country", fromIp.code);
      return fromIp;
    }
  } catch {
    // Browser locale remains the offline fallback.
  } finally {
    clearTimeout(timer);
  }

  return fromLocale || findCountry("IN");
};

export default function PhoneInputField({
  value = "",
  onChange,
  onCountryChange,
  defaultCountry = "auto",
  placeholder = "Phone Number",
}) {
  const init = parseValue(value, defaultCountry);
  const [country, setCountry] = useState(init.country);
  const [local,   setLocal]   = useState(init.local);
  const [open,    setOpen]    = useState(false);
  const [focused, setFocused] = useState(false);
  const [search,  setSearch]  = useState("");
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  const wrapRef   = useRef(null);
  const searchRef = useRef(null);
  const dropRef   = useRef(null);
  const inputRef  = useRef(null);
  const userSelectedRef = useRef(Boolean(value));
  const autoAppliedRef = useRef(false);

  const emit = useCallback((c, l) => {
    onChange?.(`+${c.dial}${l}`, {
      code: c.code,
      name: c.name,
      dialCode: `+${c.dial}`,
      dial: c.dial,
      flag: toFlag(c.code),
    });
  }, [onChange]);

  const applyCountry = useCallback((c, shouldEmit = true) => {
    setCountry(c);
    onCountryChange?.({
      code: c.code,
      name: c.name,
      dialCode: `+${c.dial}`,
      dial: c.dial,
      flag: toFlag(c.code),
    });
    if (shouldEmit) emit(c, local);
  }, [emit, local, onCountryChange]);

  const handleToggle = () => {
    if (!open && wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setOpen(v => !v);
    setSearch("");
  };

  const handleSelect = (c) => {
    userSelectedRef.current = true;
    applyCountry(c);
    setOpen(false);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleLocalChange = (e) => {
    userSelectedRef.current = true;
    const l = e.target.value.replace(/\D/g, "");
    setLocal(l);
    emit(country, l);
  };

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 40);
  }, [open]);

  useEffect(() => {
    const next = parseValue(value, country.code);
    setCountry(next.country);
    setLocal(next.local);
  }, [value]);
useEffect(() => {
  let cancelled = false;

  if (defaultCountry !== "auto" || value) return;

  if (autoAppliedRef.current) return;

  detectCountry().then((detected) => {
    if (cancelled || !detected || userSelectedRef.current) return;

    autoAppliedRef.current = true;
    applyCountry(detected, false);
  });

  return () => {
    cancelled = true;
  };
}, [defaultCountry, value]);
  // useEffect(() => {
  //   let cancelled = false;
  //   console.log("country effect fired");
  //   if (defaultCountry !== "auto" || value) {
  //     onCountryChange?.({
  //       code: country.code,
  //       name: country.name,
  //       dialCode: `+${country.dial}`,
  //       dial: country.dial,
  //       flag: toFlag(country.code),
  //     });
  //     return undefined;
  //   }
  //   if (autoAppliedRef.current) return undefined;

  //   detectCountry().then((detected) => {
  //     if (cancelled || !detected || userSelectedRef.current) return;
  //     autoAppliedRef.current = true;
  //     applyCountry(detected, false);
  //   });

  //   return () => { cancelled = true; };
  // }, [applyCountry, country.code, country.dial, country.name, defaultCountry, onCountryChange, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.dial.includes(q.replace("+", ""))
    );
  }, [search]);

  const active = open || focused;

  return (
    <>
      <style>{`
        @keyframes pif-drop {
          from { opacity:0; transform:translateY(-6px) scale(0.98); }
          to   { opacity:1; transform:translateY(0)   scale(1);    }
        }
        .pif-item { display:flex; align-items:center; gap:10px; width:100%; padding:9px 14px; border:none; background:transparent; cursor:pointer; text-align:left; font-family:inherit; transition:background 0.1s; }
        .pif-item:hover { background:#f8fafc; }
        .pif-item.sel   { background:#f0fdf4; }
        .pif-control {
          display:flex;
          align-items:center;
          width:100%;
          height:40px;
          min-height:40px;
          border:1.5px solid var(--pif-border, #c7d7fe);
          border-radius:var(--pif-radius, 12px);
          background:var(--pif-bg, #f8fbff);
          color:var(--pif-text, #1f2937);
          transition:border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease;
          overflow:hidden;
        }
        .pif-control.is-active {
          border-color:var(--pif-focus, #2563eb);
          background:var(--pif-active-bg, #fff);
          box-shadow:0 0 0 3px var(--pif-glow, rgba(37,99,235,0.12));
        }
        .pif-country-trigger {
          width:auto;
          min-width:74px;
          height:100%;
          margin:0;
          padding:0 9px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:6px;
          flex-shrink:0;
          border:none;
          border-radius:0;
          background:transparent;
          box-shadow:none;
          color:var(--pif-muted, #334155);
          cursor:pointer;
          font:inherit;
          line-height:1;
        }
        .pif-country-trigger:hover {
          background:var(--pif-hover, rgba(37,99,235,0.06));
        }
        .pif-dial {
          display:inline-flex;
          align-items:center;
          width:auto;
          margin:0;
          line-height:1;
          letter-spacing:0;
        }
        .pif-dial {
          color:var(--pif-text, #1f2937);
          font-size:14px;
          font-weight:600;
        }
        .pif-chevron {
          flex-shrink:0;
          color:var(--pif-muted, #64748b);
          opacity:0.7;
          transition:transform 0.18s ease, opacity 0.18s ease;
        }
        .pif-divider {
          width:1px;
          height:22px;
          flex-shrink:0;
          background:var(--pif-divider, #c7d7fe);
        }
        .pif-input {
          flex:1;
          min-width:0;
          height:100%;
          min-height:0;
          margin:0;
          padding:9px;
          border:none;
          border-radius:0;
          background:transparent;
          box-shadow:none;
          color:var(--pif-text, #1f2937);
          font:inherit;
          font-size:14px;
          line-height:normal;
          outline:none;
        }
        .pif-input::placeholder { color:var(--pif-placeholder, #9ca3af); }
      `}</style>

      {/* ── Unified input container ─────────────────────────────── */}
      <div
        ref={wrapRef}
        className={`pif-control${active ? " is-active" : ""}`}
      >
        {/* Flag + chevron trigger */}
        <button
          type="button"
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="pif-country-trigger"
        >
<img
  src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`}
  alt={country.code}
  style={{
    width: 20,
    height: 15,
    objectFit: "cover",
    borderRadius: 2,
  }}
/>          <svg
            width="10" height="6" viewBox="0 0 10 6" fill="none"
            className="pif-chevron"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          >
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>

                        </button>

        {/* Divider */}
        <div className="pif-divider" />

        {/* Phone number input */}
        <input
          ref={inputRef}
          type="tel"
          placeholder={placeholder}
          value={local}
          onChange={handleLocalChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="pif-input"
        />
      </div>

      {/* ── Dropdown portal ─────────────────────────────────────── */}
      {open && createPortal(
        <div
          ref={dropRef}
          role="listbox"
          style={{
            position: "absolute",
            top: dropPos.top,
            left: dropPos.left,
            width: 220,
            background: "#fff",
            border: "1.5px solid #e2e8f0",
            borderRadius: 14,
            boxShadow: "0 16px 48px rgba(0,0,0,0.13), 0 4px 12px rgba(0,0,0,0.06)",
            zIndex: 999999,
            overflow: "hidden",
            animation: "pif-drop 0.18s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {/* Search */}
          <div style={{ padding: "10px 10px 6px", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px",
              background: "#f8fafc", border: "1.5px solid #e8edf2", borderRadius: 10,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#94a3b8" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search country"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, border: "none", background: "transparent",
                  fontSize: 13, fontFamily: "inherit",
                  color: "#1e293b", outline: "none",
                }}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#cbd5e1", fontSize: 14, lineHeight: 1 }}>
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "18px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                No countries found
              </div>
            ) : filtered.map(c => (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={country.code === c.code}
                onClick={() => handleSelect(c)}
                className={`pif-item${country.code === c.code ? " sel" : ""}`}
              >
<img
  src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`}
  alt={c.code}
  style={{
    width: 20,
    height: 15,
    objectFit: "cover",
    borderRadius: 2,
    flexShrink: 0,
  }}
/>                <span style={{ fontSize: 13, color: "#334155", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                </span>
                <span style={{ fontSize: 12, color: "#059669", fontWeight: 700, flexShrink: 0 }}>
                  +{c.dial}
                </span>
                {country.code === c.code && (
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M1 5l3.5 3.5L11 1" stroke="#10b981" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
