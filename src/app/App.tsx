import { useState, useEffect, useRef } from 'react';
import { Pickaxe, Trophy } from 'lucide-react';

interface Resource {
  name: string;
  hp: number;
  maxHp: number;
  reward: number;
  color: string;
  bgColor: string;
  emoji: string;
}

interface Pickaxe {
  name: string;
  damage: number;
  cost: number;
}

interface MazeCell {
  col: number;
  row: number;
}

const RESOURCES = {
  stone: { name: '돌', maxHp: 10, reward: 1, color: '#9ca3af', bgColor: 'bg-gray-400', emoji: '🪨' },
  iron: { name: '철', maxHp: 20, reward: 3, color: '#d1d5db', bgColor: 'bg-gray-300', emoji: '⚙️' },
  gold: { name: '금', maxHp: 35, reward: 6, color: '#fbbf24', bgColor: 'bg-yellow-400', emoji: '🏆' },
  diamond: { name: '다이아', maxHp: 50, reward: 12, color: '#60a5fa', bgColor: 'bg-blue-400', emoji: '💎' }
};

const PICKAXES: Pickaxe[] = [
  { name: '손', damage: 1, cost: 0 },
  { name: '나무 곡괭이', damage: 2, cost: 10 },
  { name: '돌 곡괭이', damage: 3, cost: 30 },
  { name: '철 곡괭이', damage: 5, cost: 70 },
  { name: '금 곡괭이', damage: 7, cost: 150 },
  { name: '다이아 곡괭이', damage: 10, cost: 300 }
];

const STAGE_PATH = ['stone', 'stone', 'iron', 'iron', 'gold', 'gold', 'diamond'];

const MAZE_COLS = 9;
const MAZE_ROWS = 5;
const MAZE_CELL_SIZE = 74;
const MAZE_OFFSET_X = 67;
const MAZE_OFFSET_Y = 65;

const MAZE_ROUTE_CELLS: MazeCell[] = [
  { col: 0, row: 4 },
  { col: 1, row: 4 },
  { col: 2, row: 4 },
  { col: 2, row: 3 },
  { col: 2, row: 2 },
  { col: 3, row: 2 },
  { col: 4, row: 2 },
  { col: 5, row: 2 },
  { col: 5, row: 3 },
  { col: 5, row: 4 },
  { col: 6, row: 4 },
  { col: 7, row: 4 },
  { col: 7, row: 3 },
  { col: 7, row: 2 },
  { col: 7, row: 1 }
];

const MAZE_BRANCH_CELLS: MazeCell[] = [
  { col: 0, row: 2 },
  { col: 1, row: 2 },
  { col: 1, row: 1 },
  { col: 1, row: 0 },
  { col: 3, row: 4 },
  { col: 4, row: 4 },
  { col: 4, row: 3 },
  { col: 3, row: 1 },
  { col: 3, row: 0 },
  { col: 4, row: 0 },
  { col: 4, row: 1 },
  { col: 5, row: 0 },
  { col: 5, row: 1 },
  { col: 6, row: 0 },
  { col: 6, row: 1 },
  { col: 6, row: 3 },
  { col: 8, row: 1 },
  { col: 8, row: 2 },
  { col: 8, row: 3 }
];

const STAGE_ROUTE_INDEXES = [0, 2, 4, 7, 9, 11, 14];

function getMazeCellKey(col: number, row: number) {
  return `${col},${row}`;
}

function uniqueMazeCells(cells: MazeCell[]) {
  return Array.from(
    new Map(cells.map(cell => [getMazeCellKey(cell.col, cell.row), cell])).values()
  );
}

function mazeCellToPoint(cell: MazeCell) {
  return {
    x: MAZE_OFFSET_X + cell.col * MAZE_CELL_SIZE + MAZE_CELL_SIZE / 2,
    y: MAZE_OFFSET_Y + cell.row * MAZE_CELL_SIZE + MAZE_CELL_SIZE / 2
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const MAZE_FLOOR_CELLS = uniqueMazeCells([...MAZE_ROUTE_CELLS, ...MAZE_BRANCH_CELLS]);
const PATH_POSITIONS = STAGE_ROUTE_INDEXES.map(index => mazeCellToPoint(MAZE_ROUTE_CELLS[index]));

export default function App() {
  const [coins, setCoins] = useState(0);
  const [score, setScore] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [pickaxeLevel, setPickaxeLevel] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [currentBlock, setCurrentBlock] = useState<Resource>(createBlock(STAGE_PATH[0]));
  const [isBlockMined, setIsBlockMined] = useState(false);
  const [isGameCleared, setIsGameCleared] = useState(false);
  const [guideMessage, setGuideMessage] = useState('블록을 클릭해서 캐보세요!');
  const [damageNumbers, setDamageNumbers] = useState<{ id: number; damage: number; x: number; y: number }[]>([]);
  const [shake, setShake] = useState(false);
  const [breakEffect, setBreakEffect] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const damageIdRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  function createBlock(type: string): Resource {
    const template = RESOURCES[type as keyof typeof RESOURCES];
    return {
      name: template.name,
      hp: template.maxHp,
      maxHp: template.maxHp,
      reward: template.reward,
      color: template.color,
      bgColor: template.bgColor,
      emoji: template.emoji
    };
  }

  function playSound(frequency: number, duration: number, type: 'sine' | 'square' = 'sine') {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('Audio not available');
    }
  }

  function updateGuideMessage() {
    const blockType = STAGE_PATH[currentPosition];
    if (isBlockMined) {
      if (currentPosition === STAGE_PATH.length - 1) {
        setGuideMessage('🎉 마지막 광물을 캤어요! 성공!');
      } else {
        setGuideMessage('잘했어요! 다음 칸으로 이동해보세요!');
      }
    } else {
      if (currentPosition === 0) {
        setGuideMessage('블록을 클릭해서 캐보세요!');
      } else if (blockType === 'iron') {
        setGuideMessage('점점 단단해지고 있어요!');
      } else if (blockType === 'gold') {
        setGuideMessage('이제 금이 나와요!');
      } else if (blockType === 'diamond') {
        setGuideMessage('마지막 다이아입니다! 힘내세요!');
      } else {
        setGuideMessage(`${currentBlock.name}을 캐고 있어요!`);
      }
    }
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (isBlockMined || isGameCleared) return;

    const damage = PICKAXES[pickaxeLevel].damage;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDamageNumbers(prev => [...prev, { id: damageIdRef.current++, damage, x, y }]);
    setTimeout(() => {
      setDamageNumbers(prev => prev.slice(1));
    }, 1000);

    setShake(true);
    setTimeout(() => setShake(false), 100);

    playSound(300, 0.05, 'square');

    setTotalClicks(prev => prev + 1);
    dealDamage(damage);
  }

  function dealDamage(damage: number) {
    setCurrentBlock(prev => {
      const newHp = prev.hp - damage;
      if (newHp <= 0) {
        mineBlock(prev);
        return { ...prev, hp: 0 };
      }
      return { ...prev, hp: newHp };
    });
  }

  function mineBlock(block: Resource) {
    setBreakEffect(true);
    setTimeout(() => setBreakEffect(false), 200);

    playSound(600, 0.2);

    setCoins(prev => prev + block.reward);

    let scoreBonus = 10;
    if (block.name === '철') scoreBonus = 20;
    else if (block.name === '금') scoreBonus = 40;
    else if (block.name === '다이아') scoreBonus = 80;
    setScore(prev => prev + scoreBonus);

    setIsBlockMined(true);

    if (currentPosition === STAGE_PATH.length - 1) {
      setIsGameCleared(true);
      playSound(1000, 0.5);
    }
  }

  function moveToNext() {
    if (!isBlockMined || currentPosition >= STAGE_PATH.length - 1) return;

    playSound(500, 0.1);
    const nextPos = currentPosition + 1;
    setCurrentPosition(nextPos);
    setCurrentBlock(createBlock(STAGE_PATH[nextPos]));
    setIsBlockMined(false);
  }

  function buyPickaxe(level: number) {
    const pickaxe = PICKAXES[level];
    if (coins >= pickaxe.cost && level === pickaxeLevel + 1) {
      setCoins(prev => prev - pickaxe.cost);
      setPickaxeLevel(level);
      playSound(700, 0.2);
    }
  }

  function resetGame() {
    setCoins(0);
    setScore(0);
    setTotalClicks(0);
    setPickaxeLevel(0);
    setCurrentPosition(0);
    setCurrentBlock(createBlock(STAGE_PATH[0]));
    setIsBlockMined(false);
    setIsGameCleared(false);
    setGuideMessage('블록을 클릭해서 캐보세요!');
    localStorage.removeItem('miningAdventureSave');
  }

  useEffect(() => {
    const saved = localStorage.getItem('miningAdventureSave');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCoins(data.coins || 0);
        setScore(data.score || 0);
        setTotalClicks(data.totalClicks || 0);
        setPickaxeLevel(data.pickaxeLevel || 0);
        setCurrentPosition(data.currentPosition || 0);
        setIsBlockMined(data.isBlockMined || false);
        setIsGameCleared(data.isGameCleared || false);
        const pos = data.currentPosition || 0;
        setCurrentBlock(createBlock(STAGE_PATH[pos]));
      } catch (e) {
        console.error('Failed to load save', e);
      }
    }
  }, []);

  useEffect(() => {
    const data = {
      coins,
      score,
      totalClicks,
      pickaxeLevel,
      currentPosition,
      isBlockMined,
      isGameCleared
    };
    localStorage.setItem('miningAdventureSave', JSON.stringify(data));
  }, [coins, score, totalClicks, pickaxeLevel, currentPosition, isBlockMined, isGameCleared]);

  useEffect(() => {
    updateGuideMessage();
  }, [currentPosition, isBlockMined, isGameCleared, currentBlock]);

  useEffect(() => {
    const animate = () => {
      drawMap();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentPosition, isBlockMined]);

  function drawMap() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const floorSet = new Set(MAZE_FLOOR_CELLS.map(cell => getMazeCellKey(cell.col, cell.row)));
    const routeSet = new Set(MAZE_ROUTE_CELLS.map(cell => getMazeCellKey(cell.col, cell.row)));
    const roomSize = 52;
    const connectorWidth = 30;
    const connectorLength = MAZE_CELL_SIZE - roomSize + 10;
    const mazeWidth = MAZE_COLS * MAZE_CELL_SIZE;
    const mazeHeight = MAZE_ROWS * MAZE_CELL_SIZE;
    const currentRouteStep = STAGE_ROUTE_INDEXES[currentPosition] ?? 0;
    const pulse = 0.55 + 0.45 * Math.sin(Date.now() / 220);

    // 동굴 배경
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#020617');
    bgGradient.addColorStop(0.45, '#111827');
    bgGradient.addColorStop(1, '#1f2937');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 미로 외곽 프레임
    const frameX = MAZE_OFFSET_X - 24;
    const frameY = MAZE_OFFSET_Y - 24;
    drawRoundedRect(ctx, frameX, frameY, mazeWidth + 48, mazeHeight + 48, 28);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 벽 블록
    for (let row = 0; row < MAZE_ROWS; row++) {
      for (let col = 0; col < MAZE_COLS; col++) {
        if (floorSet.has(getMazeCellKey(col, row))) continue;

        const x = MAZE_OFFSET_X + col * MAZE_CELL_SIZE + 5;
        const y = MAZE_OFFSET_Y + row * MAZE_CELL_SIZE + 5;
        const blockGradient = ctx.createLinearGradient(x, y, x + MAZE_CELL_SIZE, y + MAZE_CELL_SIZE);
        blockGradient.addColorStop(0, (col + row) % 2 === 0 ? '#475569' : '#52627a');
        blockGradient.addColorStop(1, '#1e293b');

        drawRoundedRect(ctx, x, y, MAZE_CELL_SIZE - 10, MAZE_CELL_SIZE - 10, 16);
        ctx.fillStyle = blockGradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 12, y + 16);
        ctx.lineTo(x + MAZE_CELL_SIZE - 28, y + 10);
        ctx.moveTo(x + 18, y + MAZE_CELL_SIZE - 28);
        ctx.lineTo(x + MAZE_CELL_SIZE - 20, y + MAZE_CELL_SIZE - 18);
        ctx.stroke();
      }
    }

    // 미로 통로 연결
    MAZE_FLOOR_CELLS.forEach(cell => {
      const center = mazeCellToPoint(cell);
      const rightKey = getMazeCellKey(cell.col + 1, cell.row);
      const downKey = getMazeCellKey(cell.col, cell.row + 1);
      const currentKey = getMazeCellKey(cell.col, cell.row);

      if (floorSet.has(rightKey)) {
        const isRouteConnector = routeSet.has(currentKey) && routeSet.has(rightKey);
        drawRoundedRect(
          ctx,
          center.x + roomSize / 2 - 5,
          center.y - connectorWidth / 2,
          connectorLength,
          connectorWidth,
          12
        );
        ctx.fillStyle = isRouteConnector ? '#8b6a45' : '#5f4a36';
        ctx.fill();
      }

      if (floorSet.has(downKey)) {
        const isRouteConnector = routeSet.has(currentKey) && routeSet.has(downKey);
        drawRoundedRect(
          ctx,
          center.x - connectorWidth / 2,
          center.y + roomSize / 2 - 5,
          connectorWidth,
          connectorLength,
          12
        );
        ctx.fillStyle = isRouteConnector ? '#8b6a45' : '#5f4a36';
        ctx.fill();
      }
    });

    // 미로 방
    MAZE_FLOOR_CELLS.forEach(cell => {
      const center = mazeCellToPoint(cell);
      const key = getMazeCellKey(cell.col, cell.row);
      const isRouteRoom = routeSet.has(key);

      drawRoundedRect(ctx, center.x - roomSize / 2, center.y - roomSize / 2, roomSize, roomSize, 16);
      ctx.fillStyle = isRouteRoom ? '#a17a4e' : '#70553c';
      ctx.fill();
      ctx.strokeStyle = isRouteRoom ? '#d7b182' : '#9b7b55';
      ctx.lineWidth = 2;
      ctx.stroke();

      drawRoundedRect(ctx, center.x - 16, center.y - 16, 32, 32, 10);
      ctx.fillStyle = isRouteRoom ? 'rgba(244, 214, 170, 0.16)' : 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
    });

    // 현재까지 탐험한 경로 강조
    for (let i = 0; i < currentRouteStep; i++) {
      const from = mazeCellToPoint(MAZE_ROUTE_CELLS[i]);
      const to = mazeCellToPoint(MAZE_ROUTE_CELLS[i + 1]);

      if (from.x !== to.x) {
        drawRoundedRect(
          ctx,
          Math.min(from.x, to.x),
          from.y - 8,
          Math.abs(to.x - from.x),
          16,
          8
        );
      } else {
        drawRoundedRect(
          ctx,
          from.x - 8,
          Math.min(from.y, to.y),
          16,
          Math.abs(to.y - from.y),
          8
        );
      }

      ctx.fillStyle = 'rgba(110, 231, 183, 0.38)';
      ctx.fill();
    }

    // 현재 위치가 있는 방에 펄스 효과
    const activeRouteCell = mazeCellToPoint(MAZE_ROUTE_CELLS[currentRouteStep]);
    drawRoundedRect(
      ctx,
      activeRouteCell.x - 20,
      activeRouteCell.y - 20,
      40,
      40,
      14
    );
    ctx.fillStyle = isBlockMined
      ? 'rgba(250, 204, 21, 0.35)'
      : `rgba(251, 191, 36, ${0.25 + pulse * 0.25})`;
    ctx.fill();

    // 각 위치에 칸 그리기
    PATH_POSITIONS.forEach((pos, index) => {
      const blockType = STAGE_PATH[index];
      const template = RESOURCES[blockType as keyof typeof RESOURCES];
      const isPast = index < currentPosition;
      const isCurrent = index === currentPosition;

      // 칸 원 그리기
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 28, 0, Math.PI * 2);

      if (isCurrent) {
        ctx.fillStyle = isBlockMined ? '#fde047' : '#fbbf24';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 5;
        ctx.shadowColor = `rgba(251, 191, 36, ${0.45 + pulse * 0.25})`;
        ctx.shadowBlur = 18;
      } else if (isPast) {
        ctx.fillStyle = '#86efac';
        ctx.strokeStyle = '#228B22';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
      }

      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 광물 이모지
      ctx.font = '28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.emoji, pos.x, pos.y);

      // 번호
      ctx.font = 'bold 15px Arial';
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeText((index + 1).toString(), pos.x, pos.y + 44);
      ctx.fillText((index + 1).toString(), pos.x, pos.y + 44);

      // 완료 체크 표시
      if (isPast) {
        ctx.font = '22px Arial';
        ctx.fillText('✓', pos.x + 22, pos.y - 22);
      }
    });

    // 입구와 출구 표시
    const startPos = PATH_POSITIONS[0];
    const endPos = PATH_POSITIONS[PATH_POSITIONS.length - 1];
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('입구', startPos.x, startPos.y - 50);
    ctx.fillText('출구', endPos.x, endPos.y - 50);

    // 캐릭터 그리기
    const charPos = PATH_POSITIONS[currentPosition];
    ctx.font = '44px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bounce = isBlockMined ? 0 : Math.sin(Date.now() / 200) * 5;
    ctx.fillText('🙂', charPos.x, charPos.y - 60 + bounce);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-300 via-blue-200 to-green-200 p-4">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] items-start">
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-5 md:p-6 shadow-2xl border-4 border-blue-400">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold mb-3 text-blue-600">🏔️ 마인크래프트</h1>
                  <div className="text-2xl md:text-3xl text-orange-600 font-bold mb-2">🎯 목표: 끝까지 도착하기!</div>
                  <div className="text-lg md:text-2xl text-purple-600 font-bold">🧭 미로를 뚫고 마지막 광물까지 전진하세요</div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-sky-50 rounded-2xl px-4 py-3 border-2 border-sky-300 text-center">
                    <div className="text-sm text-sky-700 font-bold">현재 위치</div>
                    <div className="text-2xl font-extrabold text-sky-900">{currentPosition + 1} / {STAGE_PATH.length}</div>
                  </div>
                  <div className="bg-yellow-50 rounded-2xl px-4 py-3 border-2 border-yellow-300 text-center">
                    <div className="text-sm text-yellow-700 font-bold">코인</div>
                    <div className="text-2xl font-extrabold text-orange-600">💰 {coins}</div>
                  </div>
                  <div className="bg-green-50 rounded-2xl px-4 py-3 border-2 border-green-300 text-center">
                    <div className="text-sm text-green-700 font-bold">총 클릭</div>
                    <div className="text-2xl font-extrabold text-green-700">{totalClicks}</div>
                  </div>
                  <div className="bg-violet-50 rounded-2xl px-4 py-3 border-2 border-violet-300 text-center">
                    <div className="text-sm text-violet-700 font-bold">곡괭이</div>
                    <div className="text-lg font-extrabold text-violet-700">{PICKAXES[pickaxeLevel].name}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 md:p-6 shadow-2xl border-4 border-green-400">
              <div className="flex flex-col gap-2 mb-4 md:mb-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold text-green-700">🗺️ 모험의 지도</h3>
                  <p className="text-sm md:text-base text-slate-600 font-semibold mt-1">왼쪽 입구에서 시작해서 오른쪽 위 출구까지 미로를 따라 이동하세요.</p>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold">
                  <span className="px-3 py-2 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">현재 칸</span>
                  <span className="px-3 py-2 rounded-full bg-green-100 text-green-800 border border-green-300">완료 칸</span>
                </div>
              </div>
              <div className="flex justify-center overflow-x-auto">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={500}
                  className="rounded-2xl border-4 border-yellow-600 shadow-xl max-w-full h-auto"
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {isGameCleared ? (
              <div className="bg-gradient-to-br from-yellow-300 to-orange-400 rounded-3xl p-8 md:p-10 flex flex-col items-center justify-center min-h-[500px] shadow-2xl border-6 border-yellow-500">
                <Trophy className="text-white mb-6 animate-bounce" size={150} />
                <h2 className="text-6xl md:text-7xl font-bold mb-6 text-white drop-shadow-lg">🎉 성공!</h2>
                <p className="text-3xl md:text-4xl text-white mb-10 font-bold text-center">끝까지 도착했어요!</p>
                <button
                  onClick={resetGame}
                  className="px-10 md:px-16 py-6 md:py-8 bg-white text-orange-600 rounded-3xl font-bold text-2xl md:text-3xl hover:scale-110 transition-transform shadow-2xl border-4 border-orange-300"
                >
                  🔄 다시하기
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center min-h-[500px] relative shadow-2xl border-4 border-purple-400">
                <div className="text-2xl md:text-3xl font-bold mb-6 text-purple-600 text-center animate-bounce bg-yellow-200 px-5 py-4 rounded-2xl">
                  {guideMessage}
                </div>

                <h2 className="text-4xl md:text-5xl mb-6 font-bold text-gray-800 text-center">{currentBlock.name}을 캐세요!</h2>

                <div
                  onClick={handleClick}
                  className={`w-72 h-72 md:w-80 md:h-80 rounded-3xl ${isBlockMined ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-110 active:scale-95'} select-none relative transition-all ${currentBlock.bgColor} ${shake ? 'scale-90' : 'scale-100'} ${breakEffect ? 'opacity-0' : 'opacity-100'} shadow-2xl border-6 border-gray-600`}
                  style={{ transition: 'transform 0.1s, opacity 0.2s' }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-8xl md:text-9xl drop-shadow-lg">
                    {currentBlock.emoji}
                  </div>
                  {!isBlockMined && (
                    <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-xl md:text-2xl font-bold text-red-600 animate-bounce">
                      👆 클릭!
                    </div>
                  )}
                </div>

                {damageNumbers.map(dn => (
                  <div
                    key={dn.id}
                    className="absolute text-4xl md:text-5xl font-bold text-red-600 pointer-events-none animate-float drop-shadow-lg"
                    style={{
                      left: dn.x,
                      top: dn.y,
                      animation: 'float 1s ease-out forwards'
                    }}
                  >
                    -{dn.damage}
                  </div>
                ))}

                <div className="w-full max-w-sm mt-12">
                  <div className="flex justify-between text-xl md:text-2xl mb-3 font-bold text-gray-800">
                    <span>❤️ 체력</span>
                    <span>{currentBlock.hp} / {currentBlock.maxHp}</span>
                  </div>
                  <div className="w-full h-8 md:h-10 bg-gray-300 rounded-full overflow-hidden border-4 border-gray-500 shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-green-400 via-lime-400 to-green-500 transition-all duration-300"
                      style={{ width: `${(currentBlock.hp / currentBlock.maxHp) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid w-full max-w-md gap-3 mt-8 sm:grid-cols-2">
                  <div className="text-lg md:text-2xl text-orange-600 font-bold bg-yellow-100 px-5 py-3 rounded-2xl border-2 border-yellow-400 text-center">
                    💰 보상: +{currentBlock.reward}
                  </div>
                  <div className="flex items-center justify-center gap-2 bg-blue-100 px-5 py-3 rounded-2xl border-2 border-blue-400">
                    <Pickaxe className="text-orange-600" size={26} />
                    <span className="text-lg md:text-2xl font-bold text-blue-600">{PICKAXES[pickaxeLevel].name}</span>
                  </div>
                </div>

                {isBlockMined && currentPosition < STAGE_PATH.length - 1 && (
                  <button
                    onClick={moveToNext}
                    className="mt-10 px-10 md:px-16 py-6 md:py-8 bg-gradient-to-r from-green-400 to-emerald-500 rounded-3xl font-bold text-2xl md:text-3xl hover:scale-110 transition-transform shadow-2xl border-6 border-green-600 animate-bounce text-white"
                  >
                    ➡️ 다음 칸으로 이동!
                  </button>
                )}
              </div>
            )}

            <div className="bg-white rounded-3xl p-6 shadow-2xl border-4 border-orange-400">
              <div className="bg-yellow-100 rounded-2xl p-4 mb-6 border-3 border-yellow-400">
                <div className="text-3xl font-bold text-center text-orange-600">💰 {coins}</div>
                <div className="text-center text-sm text-gray-600 mt-1">코인</div>
              </div>

              <h3 className="text-2xl mb-4 flex items-center gap-2 font-bold text-purple-600">
                <span>🔨</span>
                <span>곡괭이 상점</span>
              </h3>

              <div className="space-y-3">
                {PICKAXES.map((pickaxe, i) => {
                  const canBuy = coins >= pickaxe.cost && i === pickaxeLevel + 1;
                  const owned = i <= pickaxeLevel;
                  return (
                    <button
                      key={i}
                      onClick={() => buyPickaxe(i)}
                      disabled={!canBuy || owned}
                      className={`w-full p-4 rounded-2xl text-left transition-all font-bold border-4 ${
                        owned
                          ? 'bg-green-400 text-white border-green-600 cursor-default'
                          : canBuy
                          ? 'bg-blue-400 hover:bg-blue-500 cursor-pointer border-blue-600 hover:scale-105 text-white'
                          : 'bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div>
                          <div className="text-xl">{pickaxe.name}</div>
                          <div className="text-sm mt-1">
                            {owned ? '✓ 보유 중' : `⚡ 공격력 ${pickaxe.damage}`}
                          </div>
                        </div>
                        {!owned && <div className="text-yellow-900 text-xl bg-yellow-200 px-3 py-1 rounded-xl">{pickaxe.cost} 💰</div>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t-4 border-purple-200">
                <h4 className="text-xl font-bold mb-3 text-purple-600">💡 게임 방법</h4>
                <div className="space-y-2 text-base bg-blue-50 p-4 rounded-2xl border-3 border-blue-200">
                  <p className="font-bold">1️⃣ 블록을 클릭해서 캐기</p>
                  <p className="font-bold">2️⃣ HP가 0이 되면 성공!</p>
                  <p className="font-bold">3️⃣ 다음 칸으로 이동하기</p>
                  <p className="font-bold">4️⃣ 곡괭이로 더 빠르게!</p>
                </div>
              </div>

              <button
                onClick={resetGame}
                className="w-full mt-6 px-6 py-5 bg-red-400 hover:bg-red-500 rounded-2xl transition-all font-bold text-xl border-4 border-red-600 hover:scale-105 text-white"
              >
                🔄 처음부터 다시하기
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-60px);
          }
        }

        .animate-float {
          animation: float 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
