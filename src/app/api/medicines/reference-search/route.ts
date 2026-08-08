import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { medicines, batches, incomingOrders } from "@/lib/db/schema";
import { eq, and, sql, like } from "drizzle-orm";
import { autoClassifySchedule } from "@/lib/scheduleClassifier";

interface IPDrugMonograph {
  genericName: string;
  brandNames: string;
  activeIngredient: string;
  purpose: string;
  warnings: string;
  dpcoStatus: string;
}

const INDIAN_PHARMACOPOEIA_DATABASE: Record<string, IPDrugMonograph> = {
  paracetamol: {
    genericName: "Paracetamol IP (Acetaminophen)",
    brandNames: "Calpol, Dolo 650, Crocin, Pacimol, Febrinil",
    activeIngredient: "Paracetamol 500mg / 650mg",
    purpose: "Analgesic (Pain Relief) & Antipyretic (Fever Reducer)",
    warnings: "Maximum 4000mg per 24 hours. Overdose causes severe liver toxicity (Hepatotoxicity). Avoid alcohol consumption during therapy.",
    dpcoStatus: "NLEM Essential Medicine (DPCO Price Controlled)",
  },
  amoxicillin: {
    genericName: "Amoxicillin Trihydrate IP",
    brandNames: "Mox 500, Novamox, Augmentin, Amoxyclav",
    activeIngredient: "Amoxicillin 250mg / 500mg",
    purpose: "Broad-Spectrum Beta-Lactam Antibacterial Antibiotic",
    warnings: "CDSCO Schedule H Prescription Drug. Complete full course as prescribed to prevent drug-resistant bacterial infections.",
    dpcoStatus: "NLEM Essential Medicine (DPCO Price Controlled)",
  },
  cefixime: {
    genericName: "Cefixime Trihydrate IP",
    brandNames: "Zifi, Taxim-O, Cefolac, Mahacef",
    activeIngredient: "Cefixime 200mg / 400mg",
    purpose: "3rd Generation Oral Cephalosporin Antibiotic",
    warnings: "CDSCO Schedule H1 Drug. Mandatory 2-Year Sales Register Logging required (Doctor Name, Patient Name, Date & Quantity).",
    dpcoStatus: "NLEM Essential Medicine (DPCO Price Controlled)",
  },
  ibuprofen: {
    genericName: "Ibuprofen IP",
    brandNames: "Combiflam, Brufen, Ibugesic",
    activeIngredient: "Ibuprofen 200mg / 400mg",
    purpose: "Non-Steroidal Anti-Inflammatory Drug (NSAID)",
    warnings: "Take with food or milk to prevent gastric irritation. Avoid use in severe renal impairment or active peptic ulcers.",
    dpcoStatus: "Essential Medicine Standard",
  },
  azithromycin: {
    genericName: "Azithromycin Dihydrate IP",
    brandNames: "Azee 500, Azithral, Zady",
    activeIngredient: "Azithromycin 250mg / 500mg",
    purpose: "Macrolide Antibiotic for Respiratory & Soft Tissue Infections",
    warnings: "CDSCO Schedule H Drug. Administer 1 hour before or 2 hours after meals for optimal absorption.",
    dpcoStatus: "NLEM Essential Medicine (DPCO Price Controlled)",
  },
  pantoprazole: {
    genericName: "Pantoprazole Sodium IP",
    brandNames: "Pan 40, Pantocid, Pantodac",
    activeIngredient: "Pantoprazole 40mg",
    purpose: "Proton Pump Inhibitor (Anti-Ulcerative / GERD Relief)",
    warnings: "Best administered on an empty stomach 30 minutes before breakfast.",
    dpcoStatus: "Essential Medicine Standard",
  },
  thromboscar: {
    genericName: "Heparinoid / Hirudin Topical IP Formulation",
    brandNames: "Thromboscar Gel, Thrombophob Gel",
    activeIngredient: "Heparinoid 0.3% w/w",
    purpose: "Topical Anti-Thrombotic & Anti-Inflammatory Gel for Superficial Thrombophlebitis & Bruising",
    warnings: "For external topical application only. Do not apply to open wounds, broken skin, or eyes.",
    dpcoStatus: "Topical Formulary Standard",
  },
};

export async function GET(req: Request) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() || "";

  if (!q) {
    return NextResponse.json([]);
  }

  const shopId = session.user.shopId;
  const lowerQ = q.toLowerCase();

  try {
    // 1. Map generic US name for openFDA if needed (e.g. Paracetamol -> Acetaminophen)
    let fdaQueryTerm = q;
    if (lowerQ.includes("paracetamol")) fdaQueryTerm = "Acetaminophen";

    let fdaResults: Array<{
      generic_name?: string[];
      brand_name?: string[];
      active_ingredient?: string[];
      purpose?: string[];
      warnings?: string[];
    }> = [];

    try {
      const fdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(fdaQueryTerm)}"&limit=3`;
      const res = await fetch(fdaUrl, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
        fdaResults = data.results || [];
      }
    } catch (fdaError) {
      console.warn("openFDA API query skipped:", fdaError);
    }

    // 2. Lookup in Indian Pharmacopoeia Monograph Database
    let ipMonograph: IPDrugMonograph | null = null;
    for (const key of Object.keys(INDIAN_PHARMACOPOEIA_DATABASE)) {
      if (lowerQ.includes(key)) {
        ipMonograph = INDIAN_PHARMACOPOEIA_DATABASE[key];
        break;
      }
    }

    // Default IP monograph if exact key not in dict
    if (!ipMonograph) {
      const schedule = autoClassifySchedule(q);
      ipMonograph = {
        genericName: `${q} IP Formulation`,
        brandNames: `${q} Standard Brands`,
        activeIngredient: `${q} Active Pharmaceutical Ingredient`,
        purpose: "Therapeutic Pharmaceutical Agent",
        warnings:
          schedule === "H1"
            ? "CDSCO Schedule H1: Mandatory 2-year sales register logging required."
            : schedule === "H"
            ? "CDSCO Schedule H: Prescription required from Registered Medical Practitioner."
            : "General therapeutic product. Administer according to medical practitioner advice.",
        dpcoStatus: "National Drug Formulary Standard",
      };
    }

    // 3. Cross check query against local stock and pending orders
    const pattern = `%${q}%`;
    const localMeds = await db
      .select({
        id: medicines.id,
        name: medicines.name,
        manufacturer: medicines.manufacturer,
        totalStock: sql<number>`COALESCE(SUM(${batches.quantity}), 0)`,
      })
      .from(medicines)
      .leftJoin(batches, eq(medicines.id, batches.medicineId))
      .where(
        and(
          eq(medicines.shopId, shopId),
          like(medicines.name, pattern)
        )
      )
      .groupBy(medicines.id);

    const pendingOrdersList = await db
      .select({
        id: incomingOrders.id,
        medicineId: incomingOrders.medicineId,
        expectedQuantity: incomingOrders.expectedQuantity,
        expectedArrivalDate: incomingOrders.expectedArrivalDate,
        status: incomingOrders.status,
      })
      .from(incomingOrders)
      .where(
        and(
          eq(incomingOrders.shopId, shopId),
          eq(incomingOrders.status, "pending")
        )
      );

    const detectedSchedule = autoClassifySchedule(q);

    return NextResponse.json({
      query: q,
      cdscoInfo: {
        authority: "CDSCO (Central Drugs Standard Control Organization, India)",
        pharmacopoeia: "Indian Pharmacopoeia (IP) Monograph Standard",
        schedule: detectedSchedule,
        scheduleNotice:
          detectedSchedule === "H1"
            ? "⚠️ CDSCO Schedule H1 Drug: Mandatory 2-Year Sales Register Logging (Doctor & Patient Details required)."
            : detectedSchedule === "H"
            ? "⚠️ CDSCO Schedule H Drug: Prescription required from Registered Medical Practitioner."
            : detectedSchedule === "X"
            ? "🔴 CDSCO Schedule X Drug: Narcotic / Psychotropic controlled substance. Duplicate prescription & lock storage required."
            : "🟢 CDSCO Over-The-Counter (OTC) Drug: General sales permitted.",
      },
      ipMonograph,
      fdaResults: fdaResults.map((item) => ({
        genericName: item.generic_name?.[0] || q,
        brandName: item.brand_name?.[0] || "N/A",
        activeIngredient: item.active_ingredient?.[0] || q,
        purpose: item.purpose?.[0] || "Pharmaceutical Formulation",
        warnings: item.warnings?.[0]?.substring(0, 300) + "..." || "N/A",
      })),
      localMatch: localMeds,
      pendingOrdersCount: pendingOrdersList.length,
    });
  } catch (error: unknown) {
    console.error("Reference search error:", error);
    return NextResponse.json({
      query: q,
      cdscoInfo: null,
      ipMonograph: null,
      fdaResults: [],
      localMatch: [],
      pendingOrdersCount: 0,
    });
  }
}
