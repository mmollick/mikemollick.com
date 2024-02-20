const dataToMerge = [
   {
      "domain":"apple.com",
      "employees":500
   },
   {
      "id":13,
      "login_count":150
   },
   {
      "id":13,
      "domain":"apple.com",
      "dau":5
   },
   {
      "domain":"google.com",
      "employees":1500
   },
   {
      "id":3,
      "login_count":1800
   },
   {
      "id":4,
      "domain":"google.com",
      "dau":13
   }
]


const identifyingColumnNames = ["id", "domain"]


// Expected output for these inputs: [{ id: 13, domain: “apple.com”, dau: 5, employees: 500, login_count: 150 }, { id: 3, domain: “google.com”, dau: 13, employees: 1500, login_count: 1800 }]

function mergeData(dataToMerge, identifyingColumnNames) {
  let mergedData = dataToMerge;
  for (const identifier of identifyingColumnNames) {
    const unmerged = []
    const tempMerged = mergedData.reduce((prev, current) => {
      const id = current[identifier]
      if (id) {
        prev[id] = {...prev?.[id], ...current}
      } else {
        unmerged.push(current)
      }

      return prev;
    }, {})

    mergedData = [...Object.values(tempMerged), ...unmerged];
  }

  return mergedData;
}

console.log({result: mergeData(dataToMerge, identifyingColumnNames)})

