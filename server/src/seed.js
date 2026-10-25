import { pathToFileURL } from "node:url";
import { prisma } from "./lib/db.js";
import { hashPassword } from "./lib/security.js";
import { seedAccounts } from "./lib/accounting.js";
import { mutate, transitionOrder, allocatePayment } from "./lib/operations.js";
import { demoEnabled } from "../../shared/database-config.js";

export async function seed(db) {
  await seedAccounts(db);
  const demo = demoEnabled();
  if (!(await db.user.count())) {
    if (
      !demo &&
      (!process.env.ADMIN_EMAIL ||
        !process.env.ADMIN_PASSWORD ||
        process.env.ADMIN_PASSWORD.length < 12)
    )
      throw new Error(
        "Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters) to initialize a non-demo workspace.",
      );
    const roles = demo ? ["ADMIN", "MANAGER", "EMPLOYEE"] : ["ADMIN"];
    for (const role of roles)
      await db.user.create({
        data: {
          name: !demo
            ? process.env.ADMIN_NAME || "Workspace owner"
            : {
                ADMIN: "Alex Morgan",
                MANAGER: "Sam Rivera",
                EMPLOYEE: "Jamie Chen",
              }[role],
          email: demo
            ? `${role.toLowerCase()}@meridian.demo`
            : process.env.ADMIN_EMAIL.toLowerCase(),
          role,
          passwordHash: hashPassword(
            demo ? "Demo@Meridian26!" : process.env.ADMIN_PASSWORD,
          ),
        },
      });
  }
  if (await db.workspaceSetting.findUnique({ where: { id: 1 } })) return;
  const admin = await db.user.findFirst({
    where: { role: "ADMIN", active: true },
  });
  if (!demo) {
    await db.workspaceSetting.create({
      data: { id: 1, name: "My workspace", email: process.env.ADMIN_EMAIL },
    });
    return;
  }
  const products = [];
  const productData = [
    ["ST-001", "Everyday notebook", "Stationery", 1250, 640],
    ["ST-002", "Precision pen set", "Stationery", 1800, 950],
    ["TE-001", "Studio headphones", "Electronics", 18500, 11900],
    ["TE-002", "Wireless keyboard", "Electronics", 9600, 6200],
    ["OF-001", "Ergonomic task chair", "Office", 34500, 22500],
    ["OF-002", "Adjustable desk lamp", "Office", 7800, 4300],
    ["ED-001", "Learning essentials kit", "Education", 4200, 2400],
    ["ED-002", "Science workbook", "Education", 2100, 1150],
    ["AC-001", "Canvas everyday tote", "Accessories", 2900, 1450],
    ["AC-002", "Insulated water bottle", "Accessories", 3600, 1950],
    ["OF-003", "Desktop organizer", "Office", 2450, 1100],
    ["ST-003", "Weekly planner", "Stationery", 1650, 850],
  ];
  for (const [sku, name, category, salePrice, purchasePrice] of productData) {
    await db.productCategory.upsert({
      where: { name: category },
      update: {},
      create: { name: category, description: `${category} essentials` },
    });
    products.push(
      await mutate(db, admin, "products", "create", {
        sku,
        name,
        category,
        salePrice,
        purchasePrice,
        active: true,
      }),
    );
  }
  const customers = [];
  const names = [
    "Northstar Creative",
    "Olive & Oak",
    "Horizon Academy",
    "Atelier Studio",
    "Summit Partners",
    "The Paper Collective",
    "Brightside Labs",
    "Cedar House",
    "Forma Design",
    "Orbit Technologies",
    "Bluebird School",
    "Fieldwork Co.",
  ];
  for (const [i, name] of names.entries())
    customers.push(
      await mutate(db, admin, "customers", "create", {
        name,
        email: `hello${i + 1}@example.com`,
        phone: `+92 300 555 ${String(1000 + i)}`,
        address: [
          "Lahore, Pakistan",
          "Karachi, Pakistan",
          "Islamabad, Pakistan",
        ][i % 3],
        active: true,
      }),
    );
  const vendors = [];
  for (const name of [
    "Atlas Supply Co.",
    "Evergreen Wholesale",
    "Pinnacle Distribution",
    "Craft & Paper",
  ])
    vendors.push(
      await mutate(db, admin, "vendors", "create", {
        name,
        email: "supply@example.com",
        phone: "+92 321 555 0100",
        address: "Karachi, Pakistan",
        active: true,
      }),
    );
  await mutate(db, admin, "bank", "create", {
    name: "Business current account",
    accountNumber: "DEMO-0001",
    openingBalance: 15000000,
    active: true,
  });
  const employees = [];
  for (const [i, name] of [
    "Ayesha Khan",
    "Omar Ahmed",
    "Sara Malik",
    "Daniel Park",
    "Maya Patel",
    "Hassan Ali",
    "Emma Wilson",
    "Zara Iqbal",
  ].entries())
    employees.push(
      await mutate(db, admin, "employees", "create", {
        employeeNo: `EMP-${String(i + 1).padStart(3, "0")}`,
        firstName: name.split(" ")[0],
        lastName: name.split(" ")[1],
        designation: [
          "Operations Lead",
          "Accountant",
          "Sales Executive",
          "Designer",
        ][i % 4],
        department: ["Operations", "Finance", "Sales", "Design"][i % 4],
        salary: 65000 + i * 7500,
        email: `team${i + 1}@example.com`,
        phone: "+92 300 555 0100",
        active: true,
      }),
    );
  const now = new Date();
  for (let m = 5; m >= 0; m--) {
    const issueDate = new Date(
      Date.UTC(now.getFullYear(), now.getMonth() - m, 3, 8),
    );
    if (m === 5) {
      const po = await mutate(db, admin, "purchases", "create", {
        vendorId: vendors[0].id,
        description: "Opening supply order",
        issueDate,
        taxRate: 0,
        discount: 0,
        lines: products.map((p) => ({
          productId: p.id,
          quantity: 100,
          unitPrice: Number(p.purchasePrice),
        })),
      });
      await transitionOrder(db, admin, "purchases", po.id, "post");
      await allocatePayment(db, admin, "purchases", po.id, {
        amount: Number(po.total),
        method: "Bank transfer",
        paidAt: issueDate,
      });
    } else {
      const po = await mutate(db, admin, "purchases", "create", {
        vendorId: vendors[m % vendors.length].id,
        description: "Monthly restock",
        issueDate,
        taxRate: 0,
        discount: 0,
        lines: products.slice(0, 6).map((p) => ({
          productId: p.id,
          quantity: 25,
          unitPrice: Number(p.purchasePrice),
        })),
      });
      await transitionOrder(db, admin, "purchases", po.id, "post");
    }
    for (let j = 0; j < 8; j++) {
      const day = Math.min(m === 0 ? now.getDate() : 27, 5 + j * 3);
      const date = new Date(
        Date.UTC(now.getFullYear(), now.getMonth() - m, day, 8),
      );
      const selected = [
        products[(j + m) % products.length],
        products[(j + m + 3) % products.length],
      ];
      const order = await mutate(db, admin, "sales", "create", {
        customerId: customers[(j + m) % customers.length].id,
        description: "Workspace essentials",
        issueDate: date,
        dueDate: new Date(date.getTime() + 14 * 86400000),
        taxRate: 5,
        discount: 0,
        lines: selected.map((p) => ({
          productId: p.id,
          quantity: 3 + ((j + 5 - m) % 8),
          unitPrice: Number(p.salePrice),
        })),
      });
      await transitionOrder(db, admin, "sales", order.id, "post");
      if (j % 3 !== 0 || m > 0)
        await allocatePayment(db, admin, "sales", order.id, {
          amount: Number(order.total),
          method: "Bank transfer",
          paidAt: date,
        });
      else if (j === 0)
        await allocatePayment(db, admin, "sales", order.id, {
          amount: Number((Number(order.total) / 2).toFixed(2)),
          method: "Card",
          paidAt: date,
        });
    }
    await mutate(db, admin, "expenses", "create", {
      category: "Building rent",
      description: "Studio workspace rent",
      amount: 65000,
      expenseDate: issueDate,
      status: "POSTED",
    });
  }
  for (const p of products.slice(8, 11)) {
    const item = await db.inventoryItem.findUnique({
      where: { productId: p.id },
    });
    await mutate(
      db,
      admin,
      "inventory",
      "update",
      {
        productId: p.id,
        quantity: 4,
        reorderLevel: 10,
        unitCost: Number(item.unitCost),
      },
      item.id,
    );
  }
  const section = await mutate(db, admin, "classes", "create", {
    className: "Grade 8",
    section: "A",
    capacity: 30,
    active: true,
  });
  for (const [i, name] of [
    "Noor Ahmed",
    "Ali Raza",
    "Hania Malik",
    "Usman Tariq",
  ].entries()) {
    const student = await mutate(db, admin, "students", "create", {
      admissionNo: `STU-${1001 + i}`,
      firstName: name.split(" ")[0],
      lastName: name.split(" ")[1],
      classSectionId: section.id,
      guardianName: "Demo guardian",
      guardianPhone: "+92 300 555 0100",
      active: true,
    });
    await mutate(db, admin, "attendance", "create", {
      studentId: student.id,
      attendanceDate: now,
      status: "PRESENT",
      note: "",
    });
    const fee = await mutate(db, admin, "fees", "create", {
      studentId: student.id,
      feeType: "Tuition",
      amount: 18500,
      dueDate: new Date(now.getTime() + 7 * 86400000),
    });
    if (i < 2)
      await mutate(db, admin, "fee-payments", "create", {
        feeRecordId: fee.id,
        amount: 18500,
        method: "Bank transfer",
        paidAt: now,
      });
  }
  await mutate(db, admin, "payroll", "create", {
    employeeId: employees[0].id,
    period: now.toISOString().slice(0, 7),
    basicSalary: Number(employees[0].salary),
    allowances: 5000,
    deductions: 0,
    status: "POSTED",
  });
  await db.contactMessage.create({
    data: {
      name: "Jordan Lee",
      email: "jordan@example.com",
      subject: "Let’s talk about Meridian",
      message:
        "This is a sample inbox message. Contact form submissions and confirmed assistant messages will appear here.",
    },
  });
  await db.workspaceSetting.create({
    data: {
      id: 1,
      name: "Meridian Studio",
      email: "hello@example.com",
      address: "Karachi, Pakistan",
      currency: "PKR",
      timezone: "Asia/Karachi",
    },
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await seed(prisma);
    process.stdout.write("Workspace initialized.\n");
  } finally {
    await prisma.$disconnect();
  }
}
