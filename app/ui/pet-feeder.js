const api = "http://localhost:8080/petfeeder"


async function activate_motor()
{
    try {
        let td = await axios({
            method: 'get',
            url: api,
            headers: {"Access-Control-Allow-Origin": "*"}
        });
        td = td.data;
        //Activate motor
        await axios({
            method: 'post',
            url: td.actions.activate.forms[0].href,
            headers: {"Access-Control-Allow-Origin": "*"},
            body: {}
        });
        update_view();
    }
    catch (err) {
        console.log(err);
    }
}

async function take_picture()
{
    try {
        let td = await axios({
            method: 'get',
            url: api,
            headers: {"Access-Control-Allow-Origin": "*"}
        });
        td = td.data;
        //Activate motor
        await axios({
            method: 'post',
            url: td.actions.picture.forms[0].href,
            headers: {"Access-Control-Allow-Origin": "*"},
            body: {}
        });
        update_view();
    }
    catch (err) {
        console.log(err);
    }
}

async function getInfo() {
    try {
        let td = await axios({
            method: 'get',
            url: api,
            headers: {"Access-Control-Allow-Origin": "*"}
        });
        td = td.data;
        const nb_activation = await axios({
            method: 'get',
            url: td.properties.nb_activation.forms[0].href,
            headers: {"Access-Control-Allow-Origin": "*"}
        });
        const food_ration = await axios({
            method: 'get',
            url: td.properties.food_ration.forms[0].href,
            headers: {"Access-Control-Allow-Origin": "*"}
        });
        const last_activation = await axios({
            method: 'get',
            url: td.properties.last_activation.forms[0].href,
            headers: {"Access-Control-Allow-Origin": "*"}
        });
        const last_picture = await axios({
            method: 'get',
            url: td.properties.last_picture.forms[0].href,
            headers: {"Access-Control-Allow-Origin": "*"}
        });
        return {
            last_activation: last_activation.data,
            food_ration: food_ration.data,
            nb_activation: nb_activation.data,
            last_picture: last_picture.data
        }
    }
    catch (err) {
        console.log(err);
    }
}

async function update_view() {

    const info = await getInfo();

    //Picture
    const img = document.getElementById("camera_img");
    img.src = `data:image/jpg;base64, ${info.last_picture}`;

    //Infos
    const info_div = document.getElementById("pet-feeder_info");
    let content = "";
    if (info != undefined)
    {
        content += "Nombre d'activations : " + info.nb_activation + "<br>";
        content += "Ration par activation : " + info.food_ration + " grammes" + "<br>";
        content += "Derniere activation : " + info.last_activation + "<br>";
    }
    info_div.innerHTML = content;
}
update_view();


//Track server update to change view
setInterval(function() {
    update_view()
},5000);