const api = "http://127.0.0.1:5000/api"

let saved_animals = null;

function is_animals_udpate(animals, new_animals)
{
    if (animals == null) return true;
    if (new_animals == undefined) return false; 
    if (Object.keys(new_animals).length != Object.keys(animals).length) return true;
    for (id in animals)
    {
        if (animals[id].current_food != new_animals[id].current_food 
            || animals[id].max_food != new_animals[id].max_food
            || animals[id].name != new_animals[id].name)
        {
            return true;
        }
    }
    return false;
}

async function getAnimals() {
    return await axios({
        method: 'get',
        url: api + "/animals",
        headers: {"Access-Control-Allow-Origin": "*"}
      })
    .then(res => res.data)
    .catch(err => console.log(err));
}

const animal_to_html = (animal) => {
    maxfood = `Quantité maximale de nourriture journalière atteinte !`
    if (animal.current_food < animal.max_food) maxfood = "";
    
    return `
        <div class="u-align-left u-container-style u-list-item u-repeater-item">
            <div class="u-container-layout u-similar-container u-container-layout-1">
                <img class="u-expanded-width u-image u-image-default u-image-1" alt="" data-image-width="130" data-image-height="150" src="data:image/jpg;base64, ${animal.img}">
                <h4 class="u-custom-font u-text u-text-2">${animal.name}</h4>
                <p class="u-custom-font u-text u-text-3">
                    Quantité mangée aujourd'hui : ${animal.current_food} grammes
                </p>
                <p class="u-custom-font u-text u-text-3">
                    Quantité maximale : ${animal.max_food} grammes / jour
                </p>
                <p style="color:red" class="u-custom-font u-text u-text-3">
                    ${maxfood}
                </p>
            </div>
        </div>
        `
}

function update_view(animals) {
    saved_animals = animals;
    const div = document.getElementById("animal-container");
    div.innerHTML = ""; //Clear
    let content = ""
    for (key in animals)
    {
        content += animal_to_html(animals[key]);   
    }
    div.innerHTML = content;
}



//First view update
console.log("Update request to server...");
getAnimals().then(new_animals => {
    if (is_animals_udpate(saved_animals, new_animals)) update_view(new_animals);
});


//Track server update to change view
setInterval(function() {
    console.log("Update request to server...");
    getAnimals().then(new_animals => {
        if (is_animals_udpate(saved_animals, new_animals)) update_view(new_animals);
    });
},3000);