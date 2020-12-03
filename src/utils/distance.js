/**
 * Calculates the distance between track points, in kilometers.
 * @param {number} p0 A track index.
 * @param {number} p1 A track index.
 * @returns {number} The distance in kilometers.
 */
function distance(p0, p1) {
    if (latLong[p0] === undefined || latLong[p1] === undefined)
        console.log("distance(" + p0 + ", " + p1 + "): invalid coordinates passed");
    if(p1 >= latLong.length)
        console.log(p1 + " >= " + latLong.length + ": p1 >= latLong.length")
    return distanceBetweenCoordinates(latLong[p0], latLong[p1])
}

/**
 * Calculates the distance between two geographic coordinates, given through latitude and longitude, in kilometers.
 * @param {number[]} p0 Coordinate - with lat and lon.
 * @param {number[]} p1 Coordinate - with lat and lon.
 * @returns {number} The distance in kilometers.
 */
function distanceBetweenCoordinates(p0, p1) {
    const lat1 = p0[0], lon1 = p0[1], lat2 = p1[0], lon2 = p1[1];
    const p = 0.017453292519943295; // Math.PI / 180
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p) / 2 +
        c(lat1 * p) * c(lat2 * p) *
        (1 - c((lon2 - lon1) * p)) / 2;

    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
}

/**
 * Finds the next track log point with a distance greater than dist starting from index idx in distances.
 * @returns {number}
 */
function nextPointInDistance(dist, idx, distances) {
    for (let i = idx; i < distances.length - 1; i++) {
        const arr = distances.slice(idx, i + 1);
        const sum = arr.reduce((a, b) => a + b);
        if (sum > dist) return i;
    }
    return -1;
}

let recursionExceptionHappened = false;
/**
 * Finds the biggest index in range of dist.
 */
function getNextPointRecursive(dist, idx, distances) {
    if(recursionExceptionHappened) return nextPointInDistance(dist, idx, distances);
    try {
        return increaseIndexRecursive(dist, idx, distances, 0);
    } catch (e) {
        recursionExceptionHappened = true;
        return nextPointInDistance(dist, idx, distances);
    }
}

/**
 * Increase idx until sum is greater than dist.
 */
function increaseIndexRecursive(dist, idx, distances, sum){
    if(sum > dist) return idx;
    if(idx >= distances.length-1) return -1;
    sum += distances[idx];
    return increaseIndexRecursive(dist, idx + 1, distances, sum)
}

/**
 * Calculates the mean of an array of numbers.
 * @param values numbers for which the mean should be calculated.
 */
function average(values) {
    const sum = values.reduce((a, b) => a + b);
    const avg = (sum / values.length) || 0;

    console.log(`The sum is: ${sum}. The average is: ${avg}.`);
}

/**
 * Calculates the length of a path starting from p0 to p1 in the IGC graph.
 */
function pathLength(distances, p0, p1) {
    const p0ToP1 = distances.slice(p0, p1 + 1); // include p1 into the path
    return p0ToP1.reduce((a, b) => a + b, 0);
}

/**
 * Calculates the bearing from p0 to p1 in degrees.
 * 0° bearing is north, 90° east, 180° south, 270° west
 * Formula from: http://www.movable-type.co.uk/scripts/latlong.html.
 * Use radians (1 radian is about 57.2958 degrees);
 */
function getBearing(p0, p1) {
    const degreeToRadians = Math.PI / 180.0;
    if(p1 === undefined) console.log("here it is", p0, p1)
    const lat1 = p0[0] * degreeToRadians;
    const lon1 = p0[1] * degreeToRadians;
    const lat2 = p1[0] * degreeToRadians;
    const lon2 = p1[1] * degreeToRadians;

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
        Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

    let bearing = Math.atan2(y, x) / degreeToRadians;
    bearing = (bearing + 360.0) % 360.0;
    return bearing;
}
