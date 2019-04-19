$(".submit_btn").on("click touch", function () {

    let val = $("#password").val();
    if (val == "edge2019") { //      CHANGE THIS LINE TO YOUR PASSWORD 
        setCookie("pass", "true", 100);
        $(".pass").hide();
    } else {

        $("#password").val("");
    }

});

if (getCookie("pass") == "true") {

    $(".pass").hide();

} else {

    if (location.hostname === 'sparkspreview.com' || location.hostname.endsWith('.sparkspreview.com')) {
        $(".pass").show();
    } else {
        $(".pass").hide();
    }
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}