$(document).ready(function () {

    $(".status_btn").on("click", function (e) {
        e.preventDefault();
        $(".status_holder").fadeIn("fast");
    });
    $(".close_status").on("click", function (e) {
        e.preventDefault();
        $(".status_holder").fadeOut("fast");
    });

    if (getParameterByName('status')) {
        $(".status_items").show();
    }
});

function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}