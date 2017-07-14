/**
 * Created by avnee on 22-06-2017.
 */

/**
 * Function to add/update the given key value as query parameter to the uri
 * */
function updateQueryStringParameter(uri, key, value) {
    var re = new RegExp("([?&])" + key + "=.*?(&|$)", "i");
    var separator = uri.indexOf('?') !== -1 ? "&" : "?";
    if (uri.match(re)) {
        return uri.replace(re, '$1' + key + "=" + value + '$2');
    }
    else {
        return uri + separator + key + "=" + value;
    }
}

module.exports = {
    updateQueryStringParameter: updateQueryStringParameter
};