export function sortDictionaryByKey(dependencies) {
	var items = Object.keys(dependencies).map(function (key) {
		return [key, dependencies[key]]
	})

	// sort the array based on the first element
	items.sort(function (first, second) {
		return ("" + first[0]).localeCompare(second[0])
	})

	var newDependencies = {}

	items.forEach((value) => {
		newDependencies[value[0]] = value[1]
	})

	return newDependencies
}
