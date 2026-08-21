# Project Singularity — 5-Minute Pitch Script

> **Total time:** 5:00 | **Format:** Live demo narration
> **Slide cues** are in brackets.

---

## [0:00–0:30] THE PROBLEM

"Every day, retail operations run on 24-hour lags. A store manager finds out the shelf ran empty at 9am—from a spreadsheet generated the night before. A buyer misses a demand surge because the analytics report runs overnight. By the time a human decides to restock, or adjusts a price, the revenue opportunity is gone.

We built Project Singularity to close that loop. From a physical shelf, to a purchase order, to a repriced product—in under two minutes, without a human making a single decision. Unless they want to."

---

## [0:30–2:00] ARCHITECTURE WALKTHROUGH

[Show architecture diagram]

"Here's what's actually running. On the left: a standard consumer webcam—no depth sensors, no special hardware—running a Python edge node on the laptop in front of you. That node runs two computer vision models every five seconds.

First: a YOLOv8 person detector, counting how many people are in a configured zone. We call this zone occupancy. Second: a shelf fill ratio detector, which compares the current camera frame to a calibrated reference image using structural similarity—SSIM. If the shelf looks meaningfully different from when it was full, we know it's running low.

These two metrics post to a Spring Boot REST API every five seconds. The API writes them to MySQL, applies threshold logic—if occupancy hits four or above for three consecutive readings, that's a demand surge. If shelf fill drops below 20%, that's a restock trigger.

When a threshold fires, the API creates what we call an Agent Mission—and it sits at status PENDING_APPROVAL. Nothing happens automatically. This is by design.

[Point to command center]

That pending mission shows up here—in the React command center. A human can review the trigger condition, the current shelf state, and make a decision. They click Approve. That's the safety rail we'd keep in production.

Once approved, three parallel Antigravity agents spawn in separate workspaces:—

The Restock Agent navigates the supplier portal, calculates a reorder quantity proportional to how empty the shelf is, adds the SKU to cart, and places a purchase order.

The Pricing Agent reads the current product price, computes a demand-based adjustment—capped at fifteen percent—writes a rationale document first, then updates the price via API.

The Reporting Agent waits for completion, then assembles a full audit trail: the trigger event, the decision made, before-and-after state, and links to screenshots. All of it visible in this dashboard."

---

## [2:00–4:00] DEMO NARRATION

[Start demo — edge mock mode running]

"Let's watch it run. The edge node is in mock mode—I want to be clear about what that means. Instead of reading a live camera, it's replaying a canned telemetry sequence that we scripted specifically for this demo. This isn't hiding anything—it's the right engineering call for a live presentation. Webcam demos are fragile on stage. The mock mode replays the exact scenario we'd show with a real camera.

[Watch telemetry chart animate]

You can see zone occupancy climbing—one, two, three, four—it's crossing our surge threshold. The shelf fill ratio is dropping simultaneously. At around the 40-second mark—

[Pending missions appear]

Two missions just appeared in the queue. A RESTOCK mission, and a REPRICE mission, both at PENDING_APPROVAL. Neither agent has done anything yet. This is the human-in-the-loop gate.

[Click Approve]

I'm approving the RESTOCK mission. Watch what happens in the Activity Feed.

[Switch to mock supplier tab if doing browser demo, or describe]

The Restock Agent is now navigating the supplier portal—Apex Supply Co., which is a local Next.js site we built for this demo. I want to be explicit: this is a safety-sandboxed mock. The agent is not touching a real e-commerce site. It is not using real payment credentials. This is a deliberate engineering decision—in a production system, you'd integrate with your actual ERP or supplier API, behind the same approval gate. We built the mock so this demo is safe, deterministic, and repeatable without risk.

The agent adds the SKU to cart, quantity calculated as a proportion of how empty the shelf is—in this case, about forty-two units. It clicks Place Order.

[Screenshot artifact appears in drawer]

A screenshot of the order confirmation just posted as an artifact. You can see it in the Mission Detail Drawer—order reference, SKU, quantity, confirmed status. This is the full audit trail: trigger event, agent action, evidence.

Now watch the Pricing Agent complete on the REPRICE mission—it writes a rationale document before touching any price, then patches the product record. That rationale is also in the artifact trail."

---

## [4:00–4:45] WHY ANTIGRAVITY SPECIFICALLY

"Now—why build this on Antigravity rather than scripted automation or a traditional workflow engine?

Three reasons.

First: parallel workspaces. The Restock, Pricing, and Reporting agents ran simultaneously in isolated contexts. No shared state, no race conditions, no agent stepping on another's work. That's a capability you get from Antigravity's architecture, not from cron jobs.

Second: artifacts as a first-class primitive. Every agent action generated a structured artifact—a plan document before acting, a screenshot as evidence, a summary for audit. We didn't build a logging system. Antigravity gave us one.

Third: the approval gate is a conversation, not a config flag. In a real deployment, you'd ask the agent to present its reasoning before you approve. The Antigravity surface makes that natural. The human-in-the-loop isn't an afterthought bolted on—it's how the system is designed to operate.

The result: a retail operations workflow that went from 'shelf is getting empty' to 'purchase order confirmed' in under two minutes, with a full audit trail, zero facial recognition, zero real payment credentials, and a human signing off at every irreversible step."

---

## [4:45–5:00] CLOSE

"Project Singularity is a demo system—but every component is production-grade. The edge node runs on any consumer webcam. The API has integration tests with Testcontainers. The frontend polls live. The agents produce verifiable artifacts.

Clone it, run docker compose up, and you'll have the full stack in under ten minutes. Questions?"
