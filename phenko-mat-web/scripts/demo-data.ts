/** Demo neighbours and listings for local development. Offsets are km east (dx) / north (dy). */

type DemoItem = {
  owner: string;
  title: string;
  description: string;
  photo: string;
  cats: string[];
  condition: "new" | "like_new" | "good" | "used";
  priceInr: number;
  hoursAgo: number;
};

export const DEMO_USERS: { key: string; name: string; area: string; bio: string; dx: number; dy: number }[] = [
  { key: "priya", name: "Priya Sharma", area: "Koregaon Park", bio: "Decluttering before a move. Everything must find a good home!", dx: 3.9, dy: 1.8 },
  { key: "rohan", name: "Rohan Mehta", area: "Shivajinagar", bio: "Cyclist, gadget nerd, serial upgrader.", dx: -1.0, dy: 1.2 },
  { key: "ananya", name: "Ananya Kulkarni", area: "Aundh", bio: "Mom of two. Toys and clothes outgrown faster than I can count.", dx: -5.2, dy: 4.2 },
  { key: "kabir", name: "Kabir Joshi", area: "Kothrud", bio: "Reader, runner, minimalist in progress.", dx: -5.2, dy: -1.4 },
  { key: "meera", name: "Meera Desai", area: "Baner", bio: "Interior stylist. I swap furniture more than I should.", dx: -7.4, dy: 4.3 },
  { key: "arjun", name: "Arjun Pillai", area: "Viman Nagar", bio: "Just moved flats — giving away what didn't fit.", dx: 6.1, dy: 5.3 },
  { key: "sara", name: "Sara Fernandes", area: "Kalyani Nagar", bio: "Fashion student. Wardrobe rotation is my cardio.", dx: 4.9, dy: 2.9 },
];

export const DEMO_ITEMS: DemoItem[] = [
  { owner: "sara", title: "Plain white cotton tee", description: "Size M, 100% cotton. Worn a handful of times, washed and folded. Great basic.", photo: "photo-1521572163474-6864f9cf17ab", cats: ["clothing", "daily-needs"], condition: "like_new", priceInr: 0, hoursAgo: 3 },
  { owner: "sara", title: "Graphic print T-shirt", description: "Beige tee with a bold blue print. Size L, relaxed fit. Just not my colour anymore.", photo: "photo-1576566588028-4147f3842f27", cats: ["clothing", "normal"], condition: "good", priceInr: 0, hoursAgo: 20 },
  { owner: "priya", title: "Black leather biker jacket", description: "Genuine leather, size S. Silver hardware, fully lined. Barely needed in Pune winters!", photo: "photo-1551028719-00167b16eac5", cats: ["clothing", "premium"], condition: "like_new", priceInr: 1500, hoursAgo: 6 },
  { owner: "kabir", title: "Neon training shoes, UK 9", description: "Lightweight gym trainers. Used for about 3 months, clean soles, no tears.", photo: "photo-1606107557195-0e29a4b5b4aa", cats: ["clothing", "sports"], condition: "good", priceInr: 800, hoursAgo: 30 },
  { owner: "sara", title: "White & orange sneakers", description: "Size UK 7. Classic air-cushion style. Some creasing on the toe box.", photo: "photo-1600185365483-26d7a4cc7519", cats: ["clothing", "normal"], condition: "good", priceInr: 600, hoursAgo: 50 },
  { owner: "kabir", title: "Black running shoes", description: "UK 10. Retired from my marathon rotation but plenty of life left for walks.", photo: "photo-1491553895911-0055eca6402d", cats: ["sports", "clothing"], condition: "used", priceInr: 0, hoursAgo: 72 },
  { owner: "priya", title: "Teal suede brogues", description: "Handmade suede brogues, size UK 6. Wore them to one wedding. Stunning colour.", photo: "photo-1560343090-f0409e92791a", cats: ["clothing", "premium"], condition: "like_new", priceInr: 900, hoursAgo: 12 },
  { owner: "rohan", title: "Wireless over-ear headphones", description: "Bluetooth, ~20h battery. Ear cushions replaced last month. Comes with cable.", photo: "photo-1505740420928-5e560c06d30e", cats: ["electronics", "normal"], condition: "good", priceInr: 700, hoursAgo: 4 },
  { owner: "arjun", title: "Wired studio headphones", description: "3.5mm jack, comfy padding. Work perfectly — I just went wireless.", photo: "photo-1583394838336-acd977736f90", cats: ["electronics"], condition: "good", priceInr: 0, hoursAgo: 26 },
  { owner: "rohan", title: "MacBook Pro 13\" (2017)", description: "8GB RAM, 256GB SSD. Battery at 81%. Great for students. Charger included.", photo: "photo-1517336714731-489689fd1ca8", cats: ["electronics", "premium"], condition: "good", priceInr: 28000, hoursAgo: 9 },
  { owner: "rohan", title: "Minimal smartwatch", description: "White strap, step and heart-rate tracking. Box and charger included.", photo: "photo-1523275335684-37898b6baf30", cats: ["electronics", "accessories"], condition: "like_new", priceInr: 1200, hoursAgo: 40 },
  { owner: "meera", title: "Smartwatch, 44mm", description: "Space grey, black sport band. Screen has a tiny scratch at the edge, otherwise perfect.", photo: "photo-1546868871-7041f2a55e12", cats: ["electronics", "premium"], condition: "good", priceInr: 6000, hoursAgo: 15 },
  { owner: "arjun", title: "24\" monitor with stand", description: "Full HD IPS monitor. New flat has no room for a desk setup. HDMI cable included.", photo: "photo-1593642632559-0c6d3fc62b89", cats: ["electronics", "normal"], condition: "good", priceInr: 4500, hoursAgo: 22 },
  { owner: "meera", title: "Green velvet 3-seater sofa", description: "Deep green velvet, solid wood legs. Super comfortable. You'll need a tempo to pick it up.", photo: "photo-1555041469-a586c61ea9bc", cats: ["furniture", "premium"], condition: "like_new", priceInr: 9000, hoursAgo: 5 },
  { owner: "arjun", title: "Rust orange sofa", description: "2.5-seater, removable cushion covers. Light wear on one armrest.", photo: "photo-1567016432779-094069958ea5", cats: ["furniture", "normal"], condition: "good", priceInr: 5000, hoursAgo: 60 },
  { owner: "meera", title: "Mustard yellow armchair", description: "Mid-century style reading chair. Instantly brightens up a corner.", photo: "photo-1586023492125-27b2c045efd7", cats: ["furniture", "home-decor"], condition: "like_new", priceInr: 2500, hoursAgo: 18 },
  { owner: "arjun", title: "Black dining chairs (pair)", description: "Two moulded chairs with cushioned seats and beech legs. Free — just take them!", photo: "photo-1592078615290-033ee584e267", cats: ["furniture", "daily-needs"], condition: "good", priceInr: 0, hoursAgo: 8 },
  { owner: "kabir", title: "Startup & business books (8)", description: "Zero to One, The Obstacle is the Way, Ego is the Enemy and more. Take the whole stack.", photo: "photo-1512820790803-83ca734da794", cats: ["books"], condition: "good", priceInr: 0, hoursAgo: 2 },
  { owner: "priya", title: "Stack of paperback novels", description: "About 12 novels — thrillers and some classics. ₹200 for the lot.", photo: "photo-1516979187457-637abb4f9353", cats: ["books", "normal"], condition: "used", priceInr: 200, hoursAgo: 44 },
  { owner: "rohan", title: "Single-speed city bike", description: "Lightweight steel frame, leather saddle. Just serviced. Perfect for early rides around Koregaon Park.", photo: "photo-1485965120184-e220f721d03e", cats: ["sports", "normal"], condition: "good", priceInr: 3500, hoursAgo: 11 },
  { owner: "rohan", title: "Carbon road bike", description: "Size 54, 22-speed groupset. Upgraded to a new frame, this one needs a new rider.", photo: "photo-1532298229144-0ec0c57515c7", cats: ["sports", "premium"], condition: "like_new", priceInr: 15000, hoursAgo: 28 },
  { owner: "ananya", title: "Mario figure collection", description: "Mario, Luigi, Peach and friends. Kids moved on to other things. Great for collectors.", photo: "photo-1566576912321-d58ddd7a6088", cats: ["kids-toys"], condition: "like_new", priceInr: 1000, hoursAgo: 7 },
  { owner: "ananya", title: "Box of vintage tin toys", description: "Robots, cars and trinkets. Mixed condition. Free to anyone who'll love them.", photo: "photo-1558060370-d644479cb6f7", cats: ["kids-toys"], condition: "used", priceInr: 0, hoursAgo: 34 },
  { owner: "ananya", title: "Die-cast toy car", description: "Cute white vintage-style car. My son has three of the same!", photo: "photo-1581235720704-06d3acfcb36f", cats: ["kids-toys", "home-decor"], condition: "like_new", priceInr: 0, hoursAgo: 55 },
  { owner: "ananya", title: "Kids superhero costumes (2)", description: "Spider-Man and Captain America, ages 4–6. Worn to one birthday party each.", photo: "photo-1519340241574-2cec6aef0c01", cats: ["kids-toys", "clothing"], condition: "like_new", priceInr: 0, hoursAgo: 13 },
  { owner: "priya", title: "Jute shopping tote", description: "Sturdy reusable tote. Have too many — say no to plastic!", photo: "photo-1544816155-12df9643f363", cats: ["daily-needs", "accessories"], condition: "new", priceInr: 0, hoursAgo: 1 },
  { owner: "arjun", title: "Moving boxes (10+)", description: "Flat-packed cardboard boxes in good shape after my move. Grab them before they go to scrap.", photo: "photo-1595246140625-573b715d11dc", cats: ["daily-needs"], condition: "good", priceInr: 0, hoursAgo: 16 },
  { owner: "meera", title: "Steel stock pot + cookware", description: "Large steel stock pot plus a couple of pans. Moving to induction, these don't fit anymore.", photo: "photo-1556911220-bff31c812dba", cats: ["kitchen", "daily-needs"], condition: "good", priceInr: 400, hoursAgo: 36 },
  { owner: "priya", title: "Teal leather handbag", description: "Structured top-handle bag with gold clasp. Comes with dust bag.", photo: "photo-1594223274512-ad4803739b7c", cats: ["accessories", "premium"], condition: "like_new", priceInr: 1800, hoursAgo: 19 },
  { owner: "kabir", title: "Brown leather backpack", description: "Fits a 15\" laptop. Leather has a lovely worn-in patina.", photo: "photo-1622560480605-d83c853bc5c3", cats: ["accessories", "normal"], condition: "good", priceInr: 1200, hoursAgo: 48 },
  { owner: "sara", title: "Layered pendant necklace", description: "Gold-tone chain with blue stone and crescent pendant. Costume jewellery, never worn.", photo: "photo-1599643478518-a784e5dc4c8f", cats: ["accessories", "premium"], condition: "new", priceInr: 2000, hoursAgo: 25 },
];
