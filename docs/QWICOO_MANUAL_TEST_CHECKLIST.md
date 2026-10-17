# Qwicoo manual test checklist (dev)

**Version:** backend `dev` = `main` = `daa693c` (~/src/order-backend). Dashboard and guest web `dev` = `main` = `000ff51` (/Users/asd/code/food-app-dashboard).

**For:** Marwan, testing by hand on the Mac.

**Written:** 17 Oct 2026.

## How to use this list

- Work from top to bottom. Each line is one test: do the step, then compare what you see with **Expected**. Tick the box when it matches.
- If a step fails, write a short note under it: what you did, what you saw, and the time. A screenshot helps.
- The database is fresh. It holds only **admin@qwicoo.com** (the App Admin). Section 0 builds everything else, so do it first.
- Real emails are sent. The dev backend has a working email key, so invitations and reset links really go out. Only invite addresses you own; Gmail "plus" addresses work well, for example `marwan+cashier@gmail.com`.
- Two things cannot be fully tested on this Mac:
  - **Phone push notifications.** The Qwicoo app's push service (Firebase) isn't set up locally. Staff browser notifications do work.
  - **A real Paymob payment coming back.** Paymob can't call back to a Mac on your own network. You can still check that the Paymob page opens in test mode.
- Names used below: **brand** = the restaurant, **branch** = one location, **Qwicoo app** = the customer phone app, **guest** = someone ordering from a table QR code.
- These suggested test names match the steps: brand **Test Cafe**, branch **Test Cafe Downtown**, Store item **Test Mug**.

---

## 0. Setup on the fresh database

- [ ] **0.1 Start the servers.** All servers were stopped. Open Terminal and run:
  `launchctl load ~/Library/LaunchAgents/com.qwicoo.qa-mv2-8012.plist`
  `launchctl load /tmp/qa-dash-3002.plist`
  Wait about a minute, then open http://localhost:3002/login.
  **Expected:** the Qwicoo sign-in page loads.
  *If /tmp/qa-dash-3002.plist is missing after a restart of the Mac, ask for it to be recreated. It points the dashboard at the backend on port 8012.*
- [ ] **0.2 Sign in** as `admin@qwicoo.com` with the password you were given.
  **Expected:** you land on **Brands**, which is empty and offers to create your first brand. The menu shows Brands, People, Features, Delivery, Partner leads, Audit and the other platform items.
- [ ] **0.3 Create a brand** called "Test Cafe", then upload a logo (any square image).
  **Expected:** the toast says "Brand created" and the brand card appears and the logo shows. Open it: the brand page shows Logo, the **Qwicoo app** panel, Online payments (Paymob), and Branches with nothing in it yet.
- [ ] **0.4 Add a branch** ("Add branch"). Use the English and Arabic names, pick the location on the map, and leave the geofence radius as it is.
  **Expected:** the toast says "Branch created" and the branch is listed under the brand as Active.
- [ ] **0.5 Add tables.** Open the branch, go to the **Tables** tab and add tables 1, 2 and 3.
  **Expected:** the tables are listed. **Floor** shows three Available tables.
- [ ] **0.6 Print the QR codes.** Open **QR**.
  **Expected:** you see the Guest PIN, the Pickup link, and one QR code per table. Download a single QR and Download all (zip) both work.
- [ ] **0.7 Build a small menu** in **Menu**: two categories, for example Coffee and Sandwiches.
  - Add 3 or 4 items with prices.
  - Give one coffee an option, for example Size: Small or Large at +10.
  - Make sure each kitchen item has a station.
  **Expected:** the items show as Available with their prices.
- [ ] **0.8 Turn on the brand features.** Go to **Features** (or brand page → Qwicoo app → **Features**) and turn on **Qwicoo app (MOBILE_APP)**, **Store** and **Delivery** for Test Cafe.
  **Expected:** on the brand page the Qwicoo app panel shows Qwicoo app **On**, Store **On** and Delivery **On**.
- [ ] **0.9 Set up delivery areas.** Go to **Delivery**, add a governorate (for example Cairo) and a zone, and give the new branch a fee for that zone (for example EGP 25, 30 minutes).
  **Expected:** the zone and fee are saved. On the branch's **Qwicoo app** tab, "Check a fee" for that zone shows "Fee EGP 25.00. About 30 minutes."
- [ ] **0.10 Add one staff member per role** at the branch. Go to **Staff** → Add a person, enter name, email and password, and pick a role. Add a **Branch admin**, a **Cashier**, a **Waiter**, a **Kitchen** person and a **Runner**.
  **Expected:** each toast says "Staff added", and all five are listed as Active under "People at this branch".
- [ ] **0.11 Invite a brand admin by email.** Go to **People** → invite a **Brand admin** for Test Cafe, using an address you own. Open the email, follow the link, set a password.
  **Expected:** the invite shows in the list as pending, then accepted. After setting the password you land on the Test Cafe brand dashboard.

## 1. Sign-in, passwords and lock-outs

- [ ] **1.1 Sign in as each role** created in 0.10 and 0.11, one after another.
  **Expected:** each role lands on its own home screen:
  - App Admin → Brands
  - Brand admin → their brand dashboard
  - Branch admin → Floor
  - Cashier → POS
  - Kitchen → Kitchen display
  - Waiter and Runner → Floor
- [ ] **1.2 Try a wrong password many times in a row** (about 5 to 10).
  **Expected:** "Too many sign-in attempts". The button stays disabled with a countdown, then works again.
- [ ] **1.3 Use Forgot password** with your own email.
  **Expected:** the page always says "If an account exists for that email, a password reset link has been sent." The email arrives. The link lets you choose a new password and signs you in. Using the same link again is refused.
- [ ] **1.4 Deactivate a staff member** (Staff → Deactivate), then try to sign in as them.
  **Expected:** sign-in is refused. Re-activate them, or add them again, before going on.
- [ ] **1.5 Check the table PIN lock-out.** As a guest (section 5), enter a wrong table PIN several times.
  **Expected:** "That PIN didn't work." at first, then "Too many PIN attempts. Wait a moment, then try again or ask staff for help."

## 2. What each role can and cannot do

For each role, check the side menu, then type a few addresses directly into the browser. A screen the role shouldn't see should send them back with "You don't have access to that".

- [ ] **2.1 App Admin (super admin).**
  - **Can:** everything on the platform: Brands, People, Features, Delivery, Partner leads, Audit, every brand's page including the **Qwicoo app** panel and Paymob, Qwicoo app customers (after picking a restaurant), Menu, POS, Till, Analytics and Ask Qwicoo.
- [ ] **2.2 Brand admin.**
  - **Can:** see their own brand dashboard and Settings, Qwicoo app customers, Menu, Inventory, QR, Staff, Team, Floor, POS, Orders, Delivery board, KDS, Handover, Payments, Analytics and Ask Qwicoo.
  - **Cannot:** see the brand's **Qwicoo app** panel (featured, sort order, app logo and cover), Brands (all brands), Features or Delivery areas. Typing another brand's address shows nothing from that brand.
- [ ] **2.3 Regional manager.**
  - **Can:** Menu, Analytics, Offline orders and POS for their branches, and switch between branches.
  - **Cannot:** use Staff, QR, Till or the brand settings.
- [ ] **2.4 Branch admin.**
  - **Can:** their branch's Dashboard, Branch settings (all tabs, including Access PIN), Menu, QR, Staff, Team, Floor, POS, Orders, Delivery board, KDS, Handover, Payments, Till, Attendance and Offline orders.
  - **Cannot:** see other branches, the brand's Qwicoo app panel, Qwicoo app customers, or the brand's Paymob keys.
- [ ] **2.5 Cashier.**
  - **Can:** POS (including the **Store online orders** tab), Orders, Payments, Floor, Inventory (view), Delivery board and Attendance.
  - **Cannot:** Menu editing, Staff, Till, Branch settings or Qwicoo app customers.
- [ ] **2.6 Waiter.**
  - **Can:** Floor, Requests and Attendance only.
  - **Cannot:** POS, Store online orders, Delivery board, Till, Menu, Branch settings, Qwicoo app customers or the brand page. Typing these addresses sends them back to Floor.
- [ ] **2.7 Kitchen.**
  - **Can:** Kitchen display, Handover, Attendance and Inventory.
  - **Cannot:** POS, Store online orders, Delivery board, Till, Menu, Branch settings or Qwicoo app customers. Typing these addresses sends them back to the Kitchen display.
- [ ] **2.8 Runner.**
  - **Can:** Requests, Handover (ready orders only, plus checking guest codes) and Attendance.
  - **Cannot:** POS, Till, Menu or the Delivery board.

## 3. Branch settings

Sign in as the App Admin or the branch admin, then go to Branch settings.

- [ ] **3.1 Profile.** Change the address and press Save profile.
  **Expected:** it is saved and still there after you reload the page.
- [ ] **3.2 Operating hours.** Set today's hours.
  **Expected:** saved. **Attendance** now says "Today this branch opens at …".
- [ ] **3.3 Location and geofence.** Move the map pin and change the geofence radius.
  **Expected:** saved. Guests outside the radius are asked for the table PIN (5.2).
- [ ] **3.4 Financials** (tax and service fee).
  **Expected:** saved. New orders show the new tax and service fee on the receipt.
- [ ] **3.5 Access PIN.** View or change the guest table PIN.
  **Expected:** the new PIN shows on the QR screen, and only the new PIN lets a guest join.
- [ ] **3.6 Qwicoo app tab: the switches.** Turn Mobile ordering, Curbside, Drive-thru and Delivery off and on.
  **Expected:** each change shows "Qwicoo app settings saved" and survives a reload. With **Delivery** off, the Qwicoo app no longer offers delivery at this branch.
- [ ] **3.7 Qwicoo app tab: check a fee.** Pick the governorate and zone, enter an order amount and press "Check a fee".
  **Expected:** "Fee EGP 25.00. About 30 minutes." (or your own numbers). A zone with no fee says it's outside the delivery area. Then switch to Arabic and check it reads correctly.

## 4. Menu

- [ ] **4.1 Categories.** Add a category, rename it and delete an empty one.
  **Expected:** changes show straight away. The guest menu follows the same order.
- [ ] **4.2 Items.** Add an item with English and Arabic names, a price, a photo and a station.
  **Expected:** it appears on the guest menu (5.3), in Arabic too.
- [ ] **4.3 Options (modifiers).** Add a required size and an optional extra.
  **Expected:** a guest can't add the item without choosing a size. The extra adds to the price.
- [ ] **4.4 Sold out.** Mark an item sold out, then mark it available again.
  **Expected:** while sold out it is hidden or blocked for guests, on POS and in the Qwicoo app. Afterwards it is back.
- [ ] **4.5 Combos** (Menu → Combos). Create a combo from two items with a combo price.
  **Expected:** the combo is orderable and charged at the combo price.
- [ ] **4.6 Branch overrides** (Menu → Overrides). Give the branch a different price for one item.
  **Expected:** only this branch shows the new price.
- [ ] **4.7 Store: add a retail item.** Go to Menu → **Store** → Add Store item: "Test Mug", EGP 80, most per order 3.
  **Expected:** the button reads "Add Store item", then "Store item saved". The Mug appears in the Store list.
- [ ] **4.8 Store: stock.** Set On hand to 10 and press Save stock.
  **Expected:** "Stock saved". The card shows On hand 10, Held for orders 0, Available 10. When the number is low it shows a **Low** label, and at 0 it shows **Out**.

## 5. Guest ordering from a table QR code (phone browser or desktop)

- [ ] **5.1 Scan a table QR code**, or open its "Copy link" address.
  **Expected:** the guest page opens on the brand's look, asks for a nickname, and offers "Use my location" or "I have a table PIN".
- [ ] **5.2 Join with your location.**
  - **Expected inside the geofence:** you join the table.
  - **Expected outside it** (a desktop usually is): "Looks like you're a little way from us. Enter the table PIN…" Joining with the correct PIN works.
- [ ] **5.3 Browse the menu.** Use the categories, search and the item sheet with options.
  **Expected:** prices match the Menu screen, options add their price, and sold-out items can't be added.
- [ ] **5.4 Shared cart.** Join the same table from a second phone or browser and add items on both.
  **Expected:** both carts appear grouped together, with each person's dishes. Either person can send the order when the table is ready.
- [ ] **5.5 Check out.**
  **Expected:** the summary shows items, tax, service fee and total. Placing the order shows the tracking page.
- [ ] **5.6 First order with an unconfirmed location** (joined by PIN).
  **Expected:** the waiter sees "A guest order is waiting…" on Floor and must **confirm** it before it goes to the kitchen. **Reject** with a reason shows the guest that the order was rejected.
- [ ] **5.7 Pay with cash.**
  **Expected:** "A team member will come to your table to collect payment." The payment waits on the **Payments** screen until the cashier presses Confirm payment.
- [ ] **5.8 Pay online (Paymob)**, with the brand's Paymob in **Test** mode (see 15.1).
  **Expected:** the Paymob card or wallet page opens. On this Mac the result may stay "waiting", because Paymob can't call back to the Mac. Note the result.
- [ ] **5.9 Follow the order status.**
  **Expected:** the tracking page moves with the kitchen: placed, preparing, ready, served or closed.
- [ ] **5.10 Call a waiter, or ask for water, cutlery and so on.**
  **Expected:** the request appears in **Requests** for the waiter and runner. A second request shows "You already have an open request."
- [ ] **5.11 Arabic and right-to-left.** Switch the guest page to Arabic.
  **Expected:** all text is in Arabic, the layout runs right to left, and prices and numbers read correctly.
- [ ] **5.12 Pickup link** (QR → Pickup link). Open it and try the drive-thru pickup and delivery fee options.
  **Expected:** the page shows the branch, takes an order, and shows a **Pickup code** for the handover.

## 6. Qwicoo app (customer phone app)

The Flutter app isn't ready yet. Use the **mobile simulator** if you want to click through these. It lives on its own branch (food-app-simulator, `feat/mobile-simulator`, not part of dev). To start it:
`cd ~/code/food-app-simulator && API_BASE_URL=http://127.0.0.1:8012 NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8012 NEXT_PUBLIC_ENABLE_MOBILE_SIMULATOR=true npx next dev --turbopack -p 3003`
Then sign in at http://localhost:3003 as the App Admin and open **Mobile simulator**. Its steps S1 to S9 follow the list below.

- [ ] **6.1 Restaurant list.**
  **Expected:** Test Cafe appears only while **Qwicoo app (MOBILE_APP)** is on. Turn it off on the brand page and it disappears.
- [ ] **6.2 Featured and sort order.** On the brand page, tick **Featured**, set Sort order 1, add an app logo and cover, and press Save. Reload the brand page.
  **Expected:** the panel still shows your saved values. Pressing Save again without changes keeps everything, including the images. In the app list Test Cafe is first and in the Featured row, with the app logo and cover.
- [ ] **6.3 Sign up and sign in** for Test Cafe, with a new email and phone.
  **Expected:** the account is created and signed in, and the profile shows your name.
- [ ] **6.4 Pick a branch.**
  **Expected:** only branches with Mobile ordering on are listed. The menu and **Store** (the Test Mug, with stock) load.
- [ ] **6.5 No plain pickup.**
  **Expected:** the app offers only **Pickup (curbside)** and **Delivery**. Plain "pickup" is refused ("not available").
- [ ] **6.6 Curbside order, cash.** Add a car, order a coffee, choose cash.
  **Expected:**
  - The order appears on the kitchen display and POS.
  - The customer taps "I've arrived", and staff see the arrival.
  - The runner scans the customer's pickup QR on **Handover**. If the cash hasn't been taken yet: "Take payment first, then scan again."
  - After the cashier confirms the cash, the scan works and the order is Collected.
- [ ] **6.7 Delivery order, cash on delivery.** Add an address in the zone and order.
  **Expected:** the quote shows the delivery fee. The order goes to the kitchen, then appears on the **Delivery board** (11.1).
- [ ] **6.8 Paymob (card) in the app.**
  **Expected:** offered only if the brand's Paymob is set up and active. The Paymob page opens. As in 5.8, the result may not come back to the Mac.
- [ ] **6.9 Tracking and history.**
  **Expected:** the status follows staff actions (placed, ready, collected or delivered), and the order appears in the customer's history for that restaurant only.
- [ ] **6.10 Block a customer.** Sign in as the brand admin (or the App Admin, after picking the restaurant on **Qwicoo app customers**). Find the customer, press **Block** and confirm.
  **Expected:** the row shows Blocked. The customer can no longer sign in or order at Test Cafe: "This account is blocked at that restaurant." **Unblock** lets them order again. Search by name, email or phone works.

## 7. POS (the till)

- [ ] **7.1 Take a takeaway order** as the cashier, paid in cash.
  **Expected:** the order is created, the receipt can be printed or reprinted, and the order goes to the kitchen.
- [ ] **7.2 Take a dine-in order** for a table.
  **Expected:** the table turns occupied on Floor, and the order shows on the kitchen display.
- [ ] **7.3 Cancel or reject an order.**
  **Expected:** the cashier can cancel a new order with a reason. An order already in progress says "Only a branch admin can cancel an order in progress", and the branch admin can cancel it.
- [ ] **7.4 Offline till** (optional). Turn the Mac's Wi-Fi off, take an order, then turn Wi-Fi back on.
  **Expected:** "1 order waiting to sync", then "All synced. Offline orders now have their real numbers." The branch admin can review flagged orders in **Offline orders**.

## 8. Kitchen display (KDS) and Handover (Expo)

- [ ] **8.1 New ticket.** With sound on, place a new order.
  **Expected:** the ticket appears with a tone, and shows table, pickup or drive-thru, notes and the waiting time.
- [ ] **8.2 Mark dishes ready** one at a time, then use **Mark ready** for the whole ticket.
  **Expected:** the dishes are marked. The order moves to Ready, and the guest or customer sees Ready.
- [ ] **8.3 Store items never go to the kitchen.** Order only a Test Mug from the Qwicoo app.
  **Expected:** no kitchen ticket at all. A mixed order (coffee + Mug) shows only the coffee, with a "Store bag" note.
- [ ] **8.4 Handover (Expo).** Look at a ready order.
  **Expected:** it shows "Ready to hand over" and "{ready} of {total} dishes ready". Pressing hand over marks it collected. An unpaid order says "Take {amount} first on the Payments screen, then scan again."

## 9. Runner and table requests

- [ ] **9.1 Requests queue** as the runner or waiter.
  **Expected:** new requests appear. Acknowledge, Complete and Dismiss each update the status, and the guest sees the change.

## 10. Floor (waiter)

- [ ] **10.1 Floor colours.**
  **Expected:** each table's colour follows its order stage. Opening a table shows the order, total, amount due and the next step.

## 11. Delivery board

- [ ] **11.1 Waiting for the driver.** Open the board after a delivery order is ready.
  **Expected:** the card is under "Ready, waiting for the driver". It shows customer, phone, delivery fee, payment, address, "Open in maps", the items (Store items marked **Store**) and Paid or Unpaid. The board refreshes every 15 seconds.
- [ ] **11.2 On the way.**
  **Expected:** the card moves to On the way, and the customer sees it is on the way.
- [ ] **11.3 Delivered with cash.** Press Delivered.
  **Expected:** a box asks "Has the driver handed over {total} in cash?". **Mark delivered** stays greyed out until you tick the box. After that the order is Delivered and Paid.

## 12. Store online orders (POS → Store online orders tab)

- [ ] **12.1 Alert.** Keep POS open as the cashier, then place a Store-only order (Test Mug, curbside, cash) from the Qwicoo app.
  **Expected:**
  - Within about 7 seconds a "New Store order …" toast appears, with a chime if sound is on.
  - The tab count goes up.
  - The card shows the number once, with no repeat (for example "124").
- [ ] **12.2 Mark packed.**
  **Expected:** the card moves to **Packed**. A Store-only order becomes **Ready**: the customer sees "Ready for pickup", or for delivery "Ready, waiting for the driver" and it appears on the Delivery board.
- [ ] **12.3 Hand over before payment.** Press Mark handed over on an unpaid order.
  **Expected:** a plain message, "Please take payment before handing this order over." The Arabic is "يُرجى تحصيل المبلغ قبل تسليم الطلب." It must not show a code like PAYMENT_REQUIRED.
- [ ] **12.4 Take the cash** on **Payments**, then press Mark handed over again.
  **Expected:** the card moves to **Handed over**, and the customer sees Collected.
- [ ] **12.5 Mixed order** (coffee + Mug).
  **Expected:** Mark packed works, but there is no "Mark handed over" button, because the kitchen part must finish first and the hand over happens from Handover. The order is not Ready until the kitchen marks it ready.
- [ ] **12.6 Cancelled Store order.** Cancel one from the app, then try to pack it.
  **Expected:** "This order was cancelled." The Store stock it held is released.

## 13. Till (cash drawer, Z-reports, refunds)

Sign in as the branch admin and open **Till**.

- [ ] **13.1 Start a shift.** Enter an opening cash amount, for example 500, and press Start the shift.
  **Expected:** "Shift open, started with EGP 500.00". You can't start a second shift.
- [ ] **13.2 Take some cash orders** (7.1, 5.7 and 11.3).
  **Expected:** the Till doesn't show the expected cash while the shift is open (blind close).
- [ ] **13.3 End the shift.** Enter the cash you counted, press End the shift and confirm.
  **Expected:** Calculated cash and Variance appear only now. The variance is counted minus calculated.
- [ ] **13.4 Z-report.**
  **Expected:** a new numbered report (ZR-…) is listed, with one per closed drawer and none overwritten. Opening it shows gross and net sales, tax, cash, card, online, delivery fees and refunds. Print works, and it reads correctly in Arabic.
- [ ] **13.5 Refunds.** Look at an order that has a refund (Orders → open the order).
  **Expected:** the Refunds panel lists the amount, method, reason, staff member and drawer. A Paymob refund button appears only for online payments; it needs a real Paymob test payment. The refund appears in that shift's Z-report.

## 14. Orders and history

- [ ] **14.1 Filters.** Search, Status, Source, Channel (Mobile, Delivery, **Store**), Payment, Paid, and a date range.
  **Expected:** each filter narrows the list correctly. **Store** shows only orders containing Store items.
- [ ] **14.2 Open an order.**
  **Expected:** the details, receipt, refunds and Reprint receipt are shown.

## 15. Payments and Paymob settings

- [ ] **15.1 Set up Paymob** on the brand page (App Admin): Online payments (Paymob), **Test mode**, with your Paymob test keys and integration IDs.
  **Expected:** after Save the keys show only as "Current: ****1234". "Check setup" shows the Callback and Redirect URLs to copy. Turning **Active** off hides online payment for guests.
- [ ] **15.2 Pending payments** as the cashier: open the Payments screen.
  **Expected:** cash and card-terminal payments waiting for confirmation are listed. Confirm payment marks them paid, and the order can then be handed over.

## 16. Inventory

Sign in as the branch admin or brand admin.

- [ ] **16.1 Overview, stock and movements.**
  **Expected:** the pages load. Each sale creates a stock movement linked to its order.
- [ ] **16.2 Ingredients, units and recipes.** Create an ingredient, give an item a recipe, then sell the item.
  **Expected:** the ingredient stock goes down by the recipe amount.
- [ ] **16.3 Suppliers and purchase orders.** Create a purchase order, receive it, then close it.
  **Expected:** stock goes up on receive.
- [ ] **16.4 Stock counts and waste.** Do a count with a difference, and log some waste.
  **Expected:** the variance is shown for review, and waste appears in the history.
- [ ] **16.5 Prep, reports, import and settings.**
  **Expected:** prep production lowers the raw ingredients. Usage reports show figures. The import preview checks a file before saving.

## 17. Notifications and alerts

- [ ] **17.1 Browser notifications.** As the cashier, press "Enable notifications" and allow them.
  **Expected:** new orders and new Store orders show a browser notification, even when the tab is in the background.
- [ ] **17.2 Sound.** Turn sound on, on POS and the KDS.
  **Expected:** a tone for each new order or ticket. Turning sound off silences it.
- [ ] **17.3 Qwicoo app live updates** (simulator S8 live events).
  **Expected:** the customer screen updates by itself when staff mark the order packed, ready or delivered. Phone push can't be tested on this Mac.

## 18. Reports, Ask Qwicoo and the rest

- [ ] **18.1 Branch Dashboard** (branch admin) and **Analytics** (brand admin or App Admin), for Today, Yesterday, 7 days and 30 days.
  **Expected:** gross sales, net, tax, refunds, orders, average order, top and slowest items, categories and branches. The figures match the orders you placed.
- [ ] **18.2 Ask Qwicoo** (the assistant). Ask "What were today's sales?"
  **Expected:** an answer limited to what that role is allowed to see.
- [ ] **18.3 Attendance.** Check in as the cashier.
  **Expected:** the check-in is recorded as on time or late against the branch's opening time, and the branch admin sees it in the list.
- [ ] **18.4 Audit** (App Admin).
  **Expected:** the actions you took (brand created, staff added, customer blocked and so on) appear with who and when.
- [ ] **18.5 Public site.**
  **Expected:** http://localhost:3002 shows the landing page in English, and `?lang=ar` shows it in Arabic, right to left.

## 19. Language, layout and general

- [ ] **19.1 Staff screens in Arabic** (العربية in the header).
  **Expected:** every screen is translated, laid out right to left, with no English left over and no raw codes (such as PAYMENT_REQUIRED or BRAND_REQUIRED) in messages.
- [ ] **19.2 Switch branch** (an admin with more than one branch).
  **Expected:** the data changes to the chosen branch. If a POS ticket is open, you are asked before it is cleared.
- [ ] **19.3 Phone and tablet sizes.** Open POS, KDS, the Delivery board and the guest menu on a phone and an iPad.
  **Expected:** the screens can be used, and buttons are big enough to tap.

## 20. When you finish

- [ ] **20.1 Optional: stop the servers.**
  `launchctl unload ~/Library/LaunchAgents/com.qwicoo.qa-mv2-8012.plist`
  `launchctl unload /tmp/qa-dash-3002.plist`
  Stop the simulator with Ctrl+C in its Terminal window.
  The test data stays in the local database. The old data is in ~/backups/order_backend-before-wipe-20261017.dump if it is ever needed.
