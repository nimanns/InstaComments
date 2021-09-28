const express = require("express");
const app = express();
const port = process.env.PORT || 8080;
const path = require("path");
const puppeteer = require("puppeteer-core");
const chromium = require("chromium");
const http = require("http");
const https = require("https");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static(path.join(__dirname, "views/static")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.get("/", (req, res) => {
  res.render("index");
});

io.on("connection", (socket) => {
  console.log(socket.id);
  console.log("someone connected");
  socket.on("fetch request", async ({ uName, pass, link }) => {
    if (!chromium.path) chromium.install();
    const browser = await puppeteer.launch({
      executablePath: chromium.path,
      headless: false,
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      socket.emit("state change", "Logging in...");
      await page.goto("https://www.instagram.com/accounts/login");
      await page.waitForSelector('input[name="username"]');
      await page.waitForSelector('input[name="password"]');
      await page.waitForSelector('button[type="submit"]');
      await page.type('input[name="username"]', uName);
      await page.type('input[name="password"]', pass);
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
      await page.click("button.sqdOP");
      socket.emit("state change", "Navigating to the post...");
      await page.waitForNavigation();
      await page.goto(link);
      socket.emit("state change", "Loading comments...");
      while (await page.$("button.dCJp8")) {
        console.log("Clicking away");
        await page.click("button.dCJp8");
        await page.waitForTimeout(1000);
      }
      console.log("done clicking");
      socket.emit("state change", "Comments loaded!");
      const node = await page.$$eval("ul.Mr508", (e) => {
        if (!e) {
          return;
        }
        const user = e[Math.floor(Math.random() * e.length)];
        const name = user?.querySelector("a.sqdOP")?.innerText;
        const text = user?.querySelector("div.C4VMK")?.children[1].innerText;
        const image = user?.querySelector("img._6q-tv")?.src;
        return { name, text, image };
      });
      node.image = (await (await page.goto(node.image)).buffer()).toString('base64');
      await browser.close();
      if (Object.keys(node).length === 0) {
        return socket.emit("response", "No comments found!");
      }
      socket.emit("response", node);
    } catch (e) {
      await browser.close();
      socket.emit("response", `Something went wrong! ${e}`);
    }
  });
});

server.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
