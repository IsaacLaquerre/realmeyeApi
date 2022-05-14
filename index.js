import express from "express";
import request from "request";
import cheerio from "cheerio";
import clear from "clear-console";
import utils from "./utils.js";

var app = express();

const PORT = 8080;

var endpoints = {
    "player": "https://www.realmeye.com/player/",
    "graveyard": "https://www.realmeye.com/graveyard-of-player/",
    "wiki": "https://www.realmeye.com/wiki-search?q="
};

app.use(express.json());
app.use(express.static("public"));

app.listen(
    PORT,
    () => {
        clear();
        console.log("App live and listening on port " + PORT);
    }
);

app.get("/player/:username", async(req, res) => {
    if (!req.params || !req.params.username) return res.send({
        status: "error",
        error: "Missing parameters"
    });

    var itemList = [];

    await utils.requestItems().then(response => {
        itemList = response;
    });

    request(endpoints.player + req.params.username, {
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36"
        }
    }, (err, response, body) => {
        if (!err && response.statusCode === 200) {

            var $ = cheerio.load(body);

            if ($.html().includes("player-not-found")) return res.send({
                status: "error",
                error: "Unknown player"
            });

            var username = $("span.entity-name").text();

            var info = [];
            $("div.container table.summary tbody tr").each((i, element) => {
                var field = [];
                element.children.forEach(child => {
                    child.children.forEach(child => {
                        if (child.children === undefined) {
                            if (child.data) field.push(child.data);
                        } else {
                            child.children.forEach(child => {
                                if (child.data != undefined) field.push(child.data);
                                if (child.attribs && child.attribs.class) {
                                    if (child.attribs.class.includes("star")) {
                                        info.push(["Star", child.attribs.class.split(" ")[1].split("star-")[1]]);
                                    }
                                }
                            });
                        }
                    });
                });
                info.push(field);
            });

            var summary = {};
            for (var i in info) {
                var field = info[i][0];
                var value = info[i].slice(1).join("");
                if (field.indexOf(" ") != -1) field = field.split(" ")[0].toLowerCase() + field.split(" ")[1].charAt(0).toUpperCase() + field.split(" ")[1].slice(1);
                else field = field.toLowerCase();
                if (field.replace(/ /g, "").toLowerCase() != "firstseen" && field.replace(/ /g, "").toLowerCase() != "lastseen" && value.indexOf(" ") != -1) {
                    summary[field] = (isNaN(value.split(" ")[0]) ? value.split(" ")[0] : parseInt(value.split(" ")[0]));
                    summary[field + "Rank"] = parseInt(value.split(" ")[1].replace(/\(/g, "").replace(/\)/g, "").replace("th", ""));
                } else {
                    summary[field] = (isNaN(value) ? value : parseInt(value));
                }
            }

            var description = [];
            var bio = $("div.container div.description");
            bio.children().each((i, child) => {
                description.push(child.children[0].data.replace("If this is your character, then you can add some description here, when you are logged in to RealmEye.", username + " has no description yet."));
            });

            var characters = [];
            if ($("div.table-responsive").length > 0) {
                $("div.table-responsive tbody tr").each((i, element) => {
                    var character = {};
                    character.equipment = [];
                    var fields = [];
                    element.children.forEach(child => {
                        child.children.forEach(child => {
                            if (child.name === "span") {
                                if (child.attribs && child.attribs.class) {
                                    if (child.attribs.class === "pet") {
                                        character.pet = {
                                            petName: itemList[child.attribs["data-item"]][0],
                                            petId: parseInt(child.attribs["data-item"]),
                                        };
                                    } else if (child.attribs.class === "item-wrapper") {
                                        child.children.forEach(child => {
                                            var item = {};
                                            if (child.attribs.href != undefined) {
                                                child.children.forEach(child => {
                                                    item.name = child.attribs.title.split(" ").slice(0, child.attribs.title.split(" ").length - 1).join(" ");
                                                    item.tier = parseInt(child.attribs.title.split(" ")[child.attribs.title.split(" ").length - 1].replace("T", "")) || "UT";
                                                });
                                                item.wikiUrl = "https://www.realmeye.com" + child.attribs.href;
                                                character.equipment.push(item);
                                            }
                                        });
                                    } else if (child.attribs.class === "player-stats") {
                                        character.stats = child.children[0].data;
                                    }
                                }
                            } else if (child.name === "a") {
                                if (child.attribs && child.attribs.class && child.attribs.class === "character") {
                                    character.classId = parseInt(child.attribs["data-class"]);
                                    character.skin = parseInt(child.attribs["data-skin"]);
                                    character.clothingDye = parseInt(child.attribs["data-dye1"]);
                                    character.accessoryDye = parseInt(child.attribs["data-dye2"]);
                                    character.clothingDyeId = parseInt(child.attribs["data-clothing-dye-id"]);
                                    character.accessoryDyeId = parseInt(child.attribs["data-accessory-dye-id"]);
                                }
                            } else if (child.name == undefined && child.data.length != 0) {
                                fields.push(child.data);
                            }
                        });
                    });
                    if (fields.length != 0) {
                        character.className = fields[0];
                        character.level = parseInt(fields[1]);
                        character.classQuestsCompleted = parseInt(fields[2]) || fields[2];
                        character.baseFame = parseInt(fields[3]);
                        character.experience = parseInt(fields[4]);
                        character.rank = parseInt(fields[5]);
                    }
                    characters.push(character);
                });
            }

            var data = {
                username: username,
                summary: summary,
                description: description,
                characters: characters
            };

            return res.send({
                status: "ok",
                data: data
            });

        } else return res.send({
            status: "error",
            error: err
        });
    });
});

app.get("/graveyard/:username", async(req, res) => {
    if (!req.params || !req.params.username) return res.send({
        status: "error",
        error: "Missing parameters"
    });

    var itemList = [];

    await utils.requestItems().then(response => {
        itemList = response;
    });

    request(endpoints.graveyard + req.params.username, {
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36"
        }
    }, (err, response, body) => {
        if (!err && response.statusCode === 200) {

            var $ = cheerio.load(body);

            var characters = [];
            if ($("div.table-responsive").length > 0) {
                $("div.table-responsive tbody tr").each((i, element) => {
                    var character = {};
                    character.equipment = [];
                    var fields = [];
                    element.children.forEach(child => {
                        child.children.forEach(child => {
                            if (child.name === "span") {
                                if (child.attribs && child.attribs.class) {
                                    if (child.attribs.class === "item-wrapper") {
                                        child.children.forEach(child => {
                                            var item = {};
                                            if (child.attribs.href != undefined) {
                                                child.children.forEach(child => {
                                                    if (child.attribs.title === "Backpack") {
                                                        item.name = child.attribs.title;
                                                    } else {
                                                        item.name = child.attribs.title.split(" ").slice(0, child.attribs.title.split(" ").length - 1).join(" ");
                                                        item.tier = parseInt(child.attribs.title.split(" ")[child.attribs.title.split(" ").length - 1].replace("T", "")) || "UT";
                                                    }
                                                });
                                                item.wikiUrl = "https://www.realmeye.com" + child.attribs.href;
                                                character.equipment.push(item);
                                            }
                                        });
                                    } else if (child.attribs.class === "player-stats") {
                                        character.stats = child.children[0].data;
                                    } else if (child.attribs.class === "total-fame") {
                                        character.totalFame = parseInt(child.children[0].data);
                                    }
                                }
                            } else if (child.name === "a") {
                                if (child.attribs && child.attribs.class && child.attribs.class === "character") {
                                    character.classId = child.attribs["data-class"];
                                    character.skin = child.attribs["data-skin"];
                                    character.clothingDye = child.attribs["data-dye1"];
                                    character.accessoryDye = child.attribs["data-dye2"];
                                    character.clothingDyeId = child.attribs["data-clothing-dye-id"];
                                    character.accessoryDyeId = child.attribs["data-accessory-dye-id"];
                                }
                            } else if (child.name == undefined && child.data.length != 0) {
                                fields.push(child.data);
                            }
                        });
                    });
                    if (fields.length != 0) {
                        character.deathDate = new Date(fields[0]).toLocaleString();
                        character.deathTimestamp = fields[0];
                        character.className = fields[1];
                        character.level = parseInt(fields[2]);
                        character.baseFame = parseInt(fields[3]);
                        character.experience = parseInt(fields[4]);
                        character.killedBy = fields[5].replace("{s.dmg_suffoc}", "Suffocation");
                    }
                    characters.push(character);
                });
            }

            var data = {
                characters: characters
            };

            return res.send({
                status: "ok",
                data: data
            });
        } else return res.send({
            status: "error",
            error: err
        });
    });
});

app.get("/wiki/:query", async(req, res) => {
    if (!req.params || !req.params.query) return res.send({
        status: "error",
        error: "Missing parameters"
    });

    var itemList = [];

    await utils.requestItems().then(response => {
        itemList = response;
    });

    var query = req.params.query.replace(/-/g, " ").toLowerCase();

    request(endpoints.wiki + query, {
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36"
        }
    }, (err, response, body) => {
        if (!err && response.statusCode === 200) {

            var $ = cheerio.load(body);

            if ($("div.col-md-9 p.wiki-search-result").length === 0) return res.send({
                status: "error",
                error: "Couldn't find wiki page for query '" + req.params.query.replace(/-/g, " ") + "'"
            });

            var wikiUrl = "https://www.realmeye.com" + ($("div.col-md-9 p.wiki-search-result").first().children()[0].attribs.href);

            request(wikiUrl, {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36"
                }
            }, (err2, response2, body2) => {
                if (!err2 && response2.statusCode === 200) {

                    var $ = cheerio.load(body2);

                    var name = $("div.col-md-12 h1").text();

                    var type = "item";

                    try {
                        var sprite = "https:" + $("div.wiki-page img.img-responsive").filter((i, element) => element.attribs && element.attribs.title && element.attribs.title === name)[0].attribs.src;
                    } catch (err) {
                        type = "enemy";
                        sprite = "https:" + $("div.wiki-page img.img-responsive").filter((i, element) => element.attribs && element.attribs.src && element.attribs.src.split("/")[element.attribs.src.split("/").length - 1].split(".")[0].replace(/%20/g, " ") === name)[0].attribs.src;
                    }

                    console.log(sprite, type);

                    var fields = [];

                    if (type === "item") {
                        $("div.table-responsive tbody tr").each((i, element) => {
                            var field = [];
                            element.children.forEach(child => {
                                if (child.children != undefined) {
                                    child.children.forEach(child => {
                                        if (child.children === undefined) {
                                            if (child.data && child.data != "\n") field.push(child.data);
                                        } else {
                                            child.children.forEach(child => {
                                                if (child.data != undefined && child.data != "\n") field.push(child.data);
                                            });
                                        }
                                    });
                                } else {
                                    if (child.data != "\n") field.push(child.data);
                                }
                            });
                            fields.push(field);
                        });
                    } else if (type === "enemy") {
                        $("div.wiki-page p").each((i, element) => {
                            var field = [];
                            element.children.forEach(child => {
                                if (child.children != undefined) {
                                    child.children.forEach(child => {
                                        if (child.children === undefined) {
                                            if (child.data && child.data != "\n") field.push(child.data);
                                        } else {
                                            child.children.forEach(child => {
                                                if (child.data != undefined && child.data != "\n") field.push(child.data);
                                            });
                                        }
                                    });
                                } else {
                                    if (child.data != "\n") field.push(child.data);
                                }
                            });
                            fields.push(field);
                        });
                    }

                    var description = (type === "item" ? fields[0].slice(1) : fields[0].join(""));
                    var i = 1;
                    var reskins = [];
                    var reskinOf = [];
                    if (fields[1].includes("Reskin(s)")) {
                        i = 2;
                        while (fields[i][0] !== "Tier") {
                            let name = fields[i][0].split(". ")[1];
                            reskins.push({
                                name: name,
                                tier: fields[i][0].split(". ")[0],
                                wikiUrl: "https://www.realmeye.com" + $("div.table-responsive tbody tr td a").filter((i, element) => element.children[0] && element.children[0].attribs && element.children[0].attribs.title && element.children[0].attribs.title === name)[0].attribs.href
                            });
                            i++;
                        }
                    } else if (fields[1].includes("Reskin of")) {
                        i = 2;
                        while (fields[i][0] !== "Tier") {
                            let name = fields[i][0].split(". ")[1];
                            reskinOf.push({
                                name: name,
                                tier: fields[i][0].split(". ")[0],
                                wikiUrl: "https://www.realmeye.com" + $("div.table-responsive tbody tr td a").filter((i, element) => element.children[0] && element.children[0].attribs && element.children[0].attribs.title && element.children[0].attribs.title === name)[0].attribs.href
                            });
                            i++;
                        }
                    }

                    var data = {
                        name: name,
                        sprite: sprite,
                        description: description,
                    };

                    var soulbound = false;

                    console.log(fields);

                    while (fields[i][0] != "Obtained Through") {
                        if (fields[i][0] === "Tier") data.tier = (isNaN(fields[i][1]) ? fields[i][1] : parseInt(fields[i][1]));
                        if (fields[i][0] === "On Equip") data.onEquip = fields[i][1];
                        if (fields[i][0] === "XP Bonus") data.xpBonus = fields[i][1];
                        if (fields[i][0] === "Soulbound") soulbound = true;
                        if (fields[i][0] === "Feed Power") data.feedPower = parseInt(fields[i][1]);
                        if (fields[i][0] === "Loot Bag") data.lootBag = $("div.table-responsive tbody tr td img.img-responsive").filter((i, element) => element.attribs && element.attribs.title && element.attribs.title.includes("Assigned to"))[0].attribs.title.split("Assigned to ")[1].toLowerCase().split(" ")[0];
                        if (fields[i][0] === "Drops From" || fields[i][0] === "Tier Grouped Drops") {
                            data.dropsFrom = fields[i].slice(1).filter(field => !field.includes("\n"));
                            data.dropsFrom.forEach(field => {
                                if (field.startsWith(" ")) data.dropsFrom[data.dropsFrom.indexOf(field)] = field.slice(1);
                                field.trim();
                            });
                        }
                        i++;
                    }

                    if (reskins.length != 0) data.reskins = reskins;
                    if (reskinOf.length != 0) data.reskinOf = reskinOf;
                    if (soulbound) data.soulbound = true;
                    else data.soulbound = false;

                    return res.send({
                        status: "ok",
                        data: data
                    });
                } else return res.send({
                    status: "error",
                    error: err2
                });
            });
        }
    });
});