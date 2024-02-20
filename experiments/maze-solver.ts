/**
 * 0 - movable space
 * 1 - impassable wall
 * s - starting position
 * e - ending position
 */
type SpaceValues = 0 | 1 | 'e' | 's' | 'X';
type Maze = SpaceValues[][]
type Coord = {x: number, y: number};

const checkedCoords: Set<string> = new Set();

/**
 * 2-Dimensional array of playfield is given as input. Some variation of A* would be useful for solving
 */
const solveMaze = (input: Maze) => {
  const start = findStartingPoint(input);

  // iterate through Maze
  // From starting coord, look for available spaces to move in surrounding coords and recursively move through them until we end up in end space
  const path = findPath(input, [start], checkedCoords);
  if (!path) {
    throw new Error('Navigable path was unable to be determined');
  }

  for (const coord of path) {
    input[coord.y][coord.x] = 'X'
  }
  return input
}

const findPath = (input: Maze, currentPath: Coord[], checkedCoords: Set<string>): null | Coord[] => {
  const currentCoord = currentPath[currentPath.length - 1];
  const serializedCoord = `${currentCoord.x},${currentCoord.y}`
  console.log(serializedCoord)

  // Return null if we've previously checked this coordinate
  if (checkedCoords.has(serializedCoord)) {
    return null;
  }

  checkedCoords.add(serializedCoord);
  const up = traverse(currentCoord, 0, -1);
  const right = traverse(currentCoord, 1, 0);
  const down = traverse(currentCoord, 0, 1);
  const left = traverse(currentCoord, -1, 0)
  for (const coord of [up, right, down, left]) {

    const value = input[coord.y]?.[coord.x];
    // Check if navigable space
    if (value === undefined || value === 1 ) {
      continue;
    }

    if (value === 'e') {
      return [...currentPath, coord];
    }

    const result = findPath(input, [...currentPath, coord], checkedCoords)
    if (result) {
      return result;
    }
  }
  
  return null;
}

const traverse = (current: Coord, x: number, y: number): Coord => {
  return {
    x: current.x + x,
    y: current.y + y
  }
}


/**
 * Finds start and end waypoint coordinates
 */
const findStartingPoint = (input: Maze): Coord => {
  for (const y in input) {
    const startX = input[y].findIndex(val => val === 's');
    if (startX > -1) {
      return {x: startX, y: Number(y)}
    }
  }

  throw new Error('Unable to locate start waypoints')
}

console.log(solveMaze([
  ['s', 0, 1, 1],
  [1,  0, 0, 1],
  [1,  0, 1, 'e'],
  [1,  0, 0, 0]
]));