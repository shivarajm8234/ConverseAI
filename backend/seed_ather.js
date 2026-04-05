import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seed() {
  const sections = [
    // --- BRANCHES ---
    { 
      id: "AtherSpace_JP_Nagar", 
      label: "AtherSpace JP Nagar", 
      content: "Address: 292, 15th Cross, JP Nagar 5th Phase, Opposite HP Petrol Pump, Bengaluru -- 560078. Contact: +91 9240013788. Hours: 9:30 AM to 8:30 PM (All days).", 
      type: "BRANCH" 
    },
    { 
      id: "AtherSpace_Indiranagar", 
      label: "AtherSpace Indiranagar", 
      content: "Address: 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru -- 560038. Major landmark: Near 12th Main junction. Hours: 10:00 AM to 8:00 PM.", 
      type: "BRANCH" 
    },
    { 
      id: "AtherSpace_Whitefield", 
      label: "AtherSpace Whitefield", 
      content: "Address: ITPL Main Rd, KIADB Export Promotion Industrial Area, Whitefield, Bengaluru -- 560066. Hours: 10:00 AM to 8:00 PM.", 
      type: "BRANCH" 
    },
    { 
      id: "AtherSpace_HSR", 
      label: "AtherSpace HSR Layout", 
      content: "Address: 27th Main Rd, Sector 2, HSR Layout, Bengaluru -- 560102. Near HSR Police Station. Hours: 9:30 AM to 8:30 PM.", 
      type: "BRANCH" 
    },
    { 
      id: "AtherSpace_Rajajinagar", 
      label: "AtherSpace Rajajinagar", 
      content: "Address: Dr Rajkumar Rd, Rajajinagar, Bengaluru -- 560010. Near Orion Mall. Hours: 10:00 AM to 8:00 PM.", 
      type: "BRANCH" 
    },

    // --- MODELS ---
    { 
      id: "Ather_450S_Specs", 
      label: "Ather 450S", 
      content: "Motor: 5.4 kW. Top Speed: 90 kmph. Range: 122/161 km. Price: Rs 1.21L - 1.41L.", 
      type: "MODEL" 
    },
    { 
      id: "Ather_450X_Specs", 
      label: "Ather 450X", 
      content: "Motor: 6.4 kW. Top Speed: 90 kmph. Range: 126/161 km. Features: 7-inch Touchscreen, Traction Control. Price: Rs 1.47L - 1.57L.", 
      type: "MODEL" 
    },
    { 
      id: "Ather_450_Apex_Specs", 
      label: "Ather 450 Apex", 
      content: "Top Speed: 100 kmph. 0-40 in 2.9s. Warp+ mode. Price: Rs 1.90L.", 
      type: "MODEL" 
    },
    { 
      id: "Ather_Rizta_S_Specs", 
      label: "Ather Rizta S", 
      content: "Family scooter. Range: 123/159 km. 34L storage. Price: Rs 1.12L - 1.35L.", 
      type: "MODEL" 
    },
    { 
      id: "Ather_Rizta_Z_Specs", 
      label: "Ather Rizta Z", 
      content: "Premium Family. AI Voice Assistant, Wireless Charging, backrest. Price: Rs 1.32L - 1.52L.", 
      type: "MODEL" 
    },

    // --- POLICY & TECH ---
    { 
      id: "Ather_Charging_Infrastructure", 
      label: "Charging Infrastructure", 
      content: "Ather Grid (Public Fast Charging) + Home portable/Duo chargers.", 
      type: "INFRA" 
    },
    { 
      id: "Ather_Warranty_Policy", 
      label: "Ather Warranty", 
      content: "Vehicle: 3 yr / 30k km. Battery: 8 yr / 80k km (Eight70).", 
      type: "POLICY" 
    }
  ];

  console.log("🌱 Expanding Ather Knowledge Graph with multiple branches...");

  for (const s of sections) {
    await prisma.graphNode.upsert({
      where: { id: s.id },
      update: { label: s.label, metadata: { content: s.content }, type: s.type, createdAt: new Date() },
      create: { id: s.id, label: s.label, type: s.type, metadata: { content: s.content } }
    });
  }
  
  console.log("✅ Seed complete! All branches and model details updated.");
  await prisma.$disconnect();
}

seed().catch(e => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
