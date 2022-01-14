const api = "http://127.0.0.1:5000/api"

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});


async function registerAnimal() {
    const name = document.getElementById("name").value;
    if (name.length < 1) return -1;
    const max_food = parseInt(document.getElementById("quantity").value);
    if (isNaN(max_food)) return -1;
    const input_img = document.getElementById("animal_img").files[0];
    if (input_img == undefined) return -1;
    const img = await toBase64(input_img);
    let formData = new FormData();
    formData.append("img", img);
    formData.append("name", name);
    formData.append("max_food", max_food);
    const res = await axios.post(api + "/animals/add", formData, {
        headers: {
        'Content-Type': 'multipart/form-data'
        }
    });
    if (res.status == 201) return 1;
    else return 0;
}

async function register() {
    document.getElementById("incomplet_msg").style = "display:none";
    document.getElementById("error_msg").style = "display:none";
    document.getElementById("success_msg").style = "display:none";
    const status = await registerAnimal();
    if (status == -1)
    {
        document.getElementById("incomplet_msg").style = "display:block";
        setTimeout(() => {
            document.getElementById("incomplet_msg").style = "display:none";
        }, 4000);
    }
    if (status == 0)
    {
        document.getElementById("error_msg").style = "display:block";
        setTimeout(() => {
            document.getElementById("error_msg").style = "display:none";
        }, 4000);
    }
    if (status == 1)
    {
        document.getElementById("addAnimal").reset();
        document.getElementById("success_msg").style = "display:block";
        setTimeout(() => {
            document.getElementById("success_msg").style = "display:none";
        }, 4000);
    }
}