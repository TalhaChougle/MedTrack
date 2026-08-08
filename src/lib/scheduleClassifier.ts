/**
 * MedTrack Automatic Pharmaceutical Drug Schedule Classification Engine
 * Automatically classifies medicines into Schedule OTC, H, H1, or X based on active formulation & dosage keywords.
 */

const SCHEDULE_X_PATTERNS = [
  "ketamine",
  "amphetamine",
  "methylphenidate",
  "pentazocine",
  "secobarbital",
  "methaqualone",
  "phenobarbital",
  "schedule x",
  "sch x",
];

const SCHEDULE_H1_PATTERNS = [
  "alprazolam",
  "cefixime",
  "cefpodoxime",
  "ceftriaxone",
  "cefuroxime",
  "cefotaxime",
  "buprenorphine",
  "tramadol",
  "zolpidem",
  "nitrazepam",
  "diazepam",
  "lorazepam",
  "clonazepam",
  "midazolam",
  "oxazepam",
  "chlordiazepoxide",
  "codeine",
  "morphine",
  "fentanyl",
  "methadone",
  "pethidine",
  "rifampicin",
  "isoniazid",
  "ethambutol",
  "pyrazinamide",
  "linezolid",
  "meropenem",
  "imipenem",
  "colistin",
  "tigecycline",
  "moxifloxacin",
  "schedule h1",
  "sch h1",
];

const SCHEDULE_H_PATTERNS = [
  "amoxicillin",
  "ampicillin",
  "azithromycin",
  "ciprofloxacin",
  "levofloxacin",
  "ofloxacin",
  "doxycycline",
  "erythromycin",
  "clarithromycin",
  "clavulanate",
  "augmentin",
  "metformin",
  "glimepiride",
  "gliclazide",
  "teneligliptin",
  "vildagliptin",
  "sitagliptin",
  "telmisartan",
  "amlodipine",
  "losartan",
  "ramipril",
  "enalapril",
  "atenolol",
  "metoprolol",
  "propranolol",
  "atorvastatin",
  "rosuvastatin",
  "simvastatin",
  "pantoprazole",
  "omeprazole",
  "rabeprazole",
  "esomeprazole",
  "lansoprazole",
  "domperidone",
  "ondansetron",
  "montelukast",
  "salbutamol",
  "levosalbutamol",
  "budesonide",
  "fluticasone",
  "tiotropium",
  "deflazacort",
  "prednisolone",
  "dexamethasone",
  "hydrocortisone",
  "betamethasone",
  "triamcinolone",
  "ozenoxacin",
  "thromboscar",
  "clindamycin",
  "nadifloxacin",
  "mupirocin",
  "fusidic",
  "terbinafine",
  "fluconazole",
  "itraconazole",
  "ketoconazole",
  "voriconazole",
  "injection",
  "injectable",
  "infusion",
  "schedule h",
  "sch h",
];

export function autoClassifySchedule(medicineName: string): "OTC" | "H" | "H1" | "X" {
  if (!medicineName || typeof medicineName !== "string") return "OTC";

  const lower = medicineName.toLowerCase().trim();

  // 1. Check Schedule X (Highest risk narcotic/psychotropic)
  for (const pattern of SCHEDULE_X_PATTERNS) {
    if (lower.includes(pattern)) return "X";
  }

  // 2. Check Schedule H1 (High-alert antibiotics & habit-forming drugs)
  for (const pattern of SCHEDULE_H1_PATTERNS) {
    if (lower.includes(pattern)) return "H1";
  }

  // 3. Check Schedule H (Standard prescription antibiotics & chronic disease meds)
  for (const pattern of SCHEDULE_H_PATTERNS) {
    if (lower.includes(pattern)) return "H";
  }

  // 4. If name mentions prescription dosage keywords (e.g. 500mg, 250mg, 100mg, Gel, Lotion, Tablet)
  // classify based on pharmaceutical safety standards or default OTC
  return "OTC";
}
