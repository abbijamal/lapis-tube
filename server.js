//© 2019 by blubbll
("use strict");
///////////////////////////////////////////////////////////////////////////
//DEPLOY
///////////////////////////////////////////////////////////////////////////
(async () => {
  const script = "!.glitch-deploy.js";
  if (process.env.PROJECT_DOMAIN) {
    const deployfile = ":deploying:";
    require("download")(
      "https://raw.githubusercontent.com/blubbll/glitch-deploy/master/glitch-deploy.js",
      __dirname,
      {
        filename: script
      }
    ).then(() => {
      deployProcess();
    });
    const deployProcess = async () => {
      const deploy = require(`./${script}`);
      const deployCheck = async () => {
        //console.log("🐢Checking if we can deploy...");
        if (fs.existsSync(`${__dirname}/${deployfile}`)) {
          console.log("🐢💥Deploying triggered via file.");
          fs.unlinkSync(deployfile);
          await deploy({
            ftp: {
              password: process.env.DEPLOY_PASS,
              user: process.env.DEPLOY_USER,
              host: process.env.DEPLOY_HOST
            },
            clear: 0,
            verbose: 1,
            env: 1
          });
          request(
            `https://evennode-reboot.glitch.me/reboot/${process.env.DEPLOY_TOKEN}/${process.env.PROJECT_DOMAIN}`,
            (error, response, body) => {
              console.log(error || body);
            }
          );
          require("child_process").exec("refresh");
        } else setTimeout(deployCheck, 9999); //10s
      };
      setTimeout(deployCheck, 999); //1s
    };
  } else require(`./${script}`)({ env: true }); //apply env on deployed server
})();

// init project
const express = require("express"),
  app = express(),
  fs = require("fs"),
  bodyParser = require("body-parser"),
  cors = require("cors"),
  request = require("request"),
  sass = require("node-sass"),
  es6tr = require("es6-transpiler"),
  regionParser = require("accept-language-parser");

// http://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

const transpile = file => {
  var result = es6tr.run({ filename: file });
  const ext = ".es5";
  const output = `${file.replace("/build", "/public")}`;

  if (result.src)
    [
      fs.writeFileSync(
        output,
        `//💜//i love you monad\r\n${result.src.replace(/\0/gi, "")}`
      ),
      console.log(`Transpiled ${file} to ${output}!`)
    ];
  else console.warn(`Error at transpiling of file ${file}:`, result);
};

//BUILD
if (process.env.PROJECT_NAME) {
  transpile(`${__dirname}/build/tools.js`);
  transpile(`${__dirname}/build/bg.js`);
  transpile(`${__dirname}/build/client.js`);

  //SASS
  {
    const c = {
      in: `${__dirname}/build/style.sass.css`,
      out: `${__dirname}/public/style.css`
    };
    fs.writeFileSync(
      c.out,
      sass
        .renderSync({
          data: fs.readFileSync(c.in, "utf8")
        })
        .css.toString("utf8")
    );
  }
}

//API
const prefix = "/api";

app.get(`${prefix}/search/:reg::q`, (req, res) => {
  request(
    {
      uri: `${process.env.IV_HOST}/v1/search/?region=${req.params.reg}&q=${req.params.q}`,
      method: "GET",
      timeout: 3000,
      followRedirect: true,
      maxRedirects: 10,
      encoding: "latin1"
    },
    async (error, response, body) => {
      //console.warn(response);
      if (body) {
      }
    }
  );
});

app.get(`${prefix}/complete/:l::q`, (req, res) => {
  const region = regionParser.parse(req.headers["accept-language"])[0].region.toLowerCase();

  const empty = "No results found...";
  const url = `https://suggestqueries.google.com/complete/search?client=youtube&cp=1&ds=yt&q=${req.params.q}&hl=${region}&format=5&alt=json&callback=?`;
  request(
    {
      uri: url,
      method: "GET",
      timeout: 3000,
      followRedirect: true,
      maxRedirects: 10,
      encoding: "latin1"
    },
    async (error, response, body) => {
      //console.warn(response);
      if (body) {
        let suggs = [];
        //console.log(body)
        const any = !body.includes('",[],{"k"');

        if (any) {
          const raw = body
            .split(`window.google.ac.h(["${req.params.q}",[[`)[1]
            .split("]]]")[0] //trim end
            .split(","); //into arr
          raw.length--; //remove last char

          Array.prototype.forEach.call(raw, (val, key) => {
            if (val !== "0]" && val.length) {
              //reached da end
              if (val.slice(1) === "]]" || val.startsWith("{")) return;
              if (!val.slice(1).endsWith("]]") && val.slice(1).length > 1)
                suggs.push(
                  val
                    .slice(key === 0 ? 1 : 2, -1)
                    .replace(/\\u([0-9a-fA-F]{4})/g, (m, cc) =>
                      String.fromCharCode("0x" + cc)
                    )
                );
            }
          });
        }

        suggs.length
          ? res.json({ code: 200, data: suggs })
          : res.json({ code: 404, msg: empty });
      }
    }
  );
});

// listen for requests :)
const listener = app.listen(process.env.PORT, function() {
  console.log("Your app is listening on port " + listener.address().port);
});
