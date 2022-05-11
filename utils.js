import request from "request";

export default {

    requestItems() {
        return new Promise(function(resolve, reject) {
            request("https://www.realmeye.com/s/dw/js/definition.js", {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36"
                }
            }, (err, res, body) => {
                if (!err && res.statusCode === 200) {
                    var item = body.replace("items=", "").replace(/;/g, "").replace(/e3/g, "0000");
                    item = item.replace(/-?\d+:/g, function(n) {
                        if (item[item.indexOf(n) - 1] === "\"") return n.replace(/:/g, "");
                        return "\"" + n.replace(/:/g, "") + "\":";
                    });
                    resolve(JSON.parse(item));
                } else reject(err);
            });
        });
    }

};