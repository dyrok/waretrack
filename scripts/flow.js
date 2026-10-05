// Runs the case study's "Example User Flow" against a RUNNING server,
// with a Socket.io client listening, and prints what happens at each step.
// Terminal 1: npm run seed, then npm run dev
// Terminal 2: npm run flow
const { io } = require("socket.io-client");

const BASE = process.env.API_URL || "http://localhost:8000";

const call = async (method, path, token, body) => {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
};

const step = (number, text) => console.log(`\n[${number}] ${text}`);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  const staff = await call("POST", "/api/auth/login", null, {
    email: "sam@waretrack.dev",
    password: "password123",
  });
  step(1, `POST /api/auth/login (staff) -> logged in as ${staff.user.name} (${staff.user.role})`);

  // Listen to live events like the console does
  const socket = io(BASE, { auth: { token: staff.token } });
  const heard = [];
  for (const event of ["stock:changed", "alert:low-stock", "transaction:created"]) {
    socket.on(event, (payload) => heard.push(`${event} ${JSON.stringify(payload)}`));
  }
  await new Promise((resolve) => socket.once("hello", resolve));
  const printEvents = async () => {
    await wait(250);
    for (const line of heard.splice(0)) console.log("    socket <- " + line);
  };

  const rice = (await call("GET", "/api/items/search?barcode=22001", staff.token)).data[0];
  const received = await call("POST", "/api/transactions/receive", staff.token, {
    itemId: rice._id,
    bin: "A1",
    quantity: 100,
    reference: "PO-1001",
  });
  step(2, `POST /api/transactions/receive -> +${received.transaction.quantity} ${rice.sku} into bin A1`);
  await printEvents();

  // Setup for step 3: ship most of the tea so it becomes low
  const tea = (await call("GET", "/api/items/search?q=tea", staff.token)).data[0];
  const teaOnHand = (await call("GET", `/api/items/${tea._id}`, staff.token)).onHand;
  const teaShip = await call("POST", "/api/transactions/ship", staff.token, {
    itemId: tea._id,
    quantity: teaOnHand - 5,
  });
  console.log(`    (setup) shipped ${teaShip.shipped} ${tea.sku} so it falls below its reorder level`);
  await printEvents();
  const low = await call("GET", "/api/inventory/low-stock", staff.token);
  const lowList = low.data.map((d) => `${d.item.sku} (${d.onHand}/${d.reorderLevel})`).join(", ");
  step(3, `GET /api/inventory/low-stock -> ${low.data.length} item(s) low: ${lowList}`);

  const manager = await call("POST", "/api/auth/login", null, {
    email: "maya@waretrack.dev",
    password: "password123",
  });
  const moved = await call("POST", "/api/transactions/transfer", manager.token, {
    itemId: rice._id,
    fromBin: "A1",
    toBin: "B2",
    quantity: 40,
  });
  step(
    4,
    `POST /api/transactions/transfer (manager) -> moved ${moved.moved} ${rice.sku} ${moved.from} -> ${moved.to}`,
  );
  await printEvents();

  const oil = (await call("GET", "/api/items/search?q=oil", staff.token)).data[0];
  const shipped = await call("POST", "/api/transactions/ship", staff.token, {
    itemId: oil._id,
    quantity: 20,
    reference: "SO-2001",
  });
  const bins = shipped.picks.map((p) => p.bin).join(", ");
  step(5, `POST /api/transactions/ship -> ${shipped.shipped} ${oil.sku} outbound, picked from ${bins}`);
  await printEvents();

  const turnover = await call("GET", "/api/reports/turnover?months=6", manager.token);
  step(6, "GET /api/reports/turnover -> monthly units shipped:");
  for (const m of turnover.monthly) {
    console.log(
      `    ${m.month}  ${String(m.unitsShipped).padStart(5)} units  cost ${m.costOfGoods.toFixed(2)}`,
    );
  }

  const found = await call("GET", "/api/items/search?barcode=12345", staff.token);
  step(7, `GET /api/items/search?barcode=12345 -> ${found.data[0].name}, ${found.data[0].onHand} on hand`);

  socket.close();
};

run();
