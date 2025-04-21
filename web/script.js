document.addEventListener('DOMContentLoaded', () => {

  // --- Game Words ---
  let words = [];
  let usedWordIndices = new Set(); // Keep track of indices of words already used

  // --- Difficulty Levels ---
  const difficultyLevels = [
    { score: 0, maxLength: 3 },
    { score: 5, maxLength: 4 },
    { score: 10, maxLength: 5 },
    { score: 15, maxLength: 6 },
    { score: 20, maxLength: Infinity }, // Or 999
  ];
  let currentMaxLength = difficultyLevels[0].maxLength;

  // --- Timer Settings ---
  const timeLimit = 20; // Seconds per word
  let timeLeft = timeLimit;
  let timerInterval = null;

  // --- DOM Elements ---
  // Screens
  const loadingScreen = document.getElementById('loading-screen');
  const startScreen = document.getElementById('start-screen');
  const gameContainer = document.getElementById('game-container');
  const gameOverScreen = document.getElementById('game-over-screen'); // New Game Over Screen

  // Start Screen Elements
  const lastScoreSpan = document.getElementById('last-score');
  const startButton = document.getElementById('start-button');

  // Game Elements
  const scrambledContainer = document.getElementById('scrambled-letters');
  const answerContainer = document.getElementById('answer-boxes');
  const messageEl = document.getElementById('message');
  const scoreEl = document.getElementById('score');
  const clearButton = document.getElementById('clear-button');
  const timerEl = document.getElementById('timer');
  const timerSpan = document.getElementById('time-left-span'); // Span for time number

  // Game Over Screen Elements
  const finalScoreDisplay = document.getElementById('final-score-display'); // Span for final score
  const gameOverMessageEl = document.getElementById('game-over-message'); // Paragraph for message
  const gameOverPlayAgainButton = document.getElementById('game-over-play-again'); // Play Again button
  const gameOverGoStartButton = document.getElementById('game-over-go-start'); // Go to Start button

  const highscoreList = document.getElementById('highscores-list');
  let currentUsername = 'ޔޫސާގެނަން'; // Default fallback



  // --- Game State ---
  let currentWordIndex = -1;
  let currentWord = '';
  let scrambledGraphemes = [];
  let userAnswer = [];
  let score = 0;
  let letterElements = {}; // Keep track of scrambled letter DOM elements { originalIndex: element }
  let answerElements = []; // Keep track of answer box DOM elements


  // --- Functions ---

  // Fisher-Yates (Knuth) Shuffle Algorithm
  function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
    return array;
  }

  // --- Function to load words from a JSON file ---
  // Returns true on success, false on failure
  async function loadWords(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const loadedWords = await response.json();

      if (!Array.isArray(loadedWords) || loadedWords.some(word => typeof word !== 'string')) {
        throw new Error("Loaded data is not a valid JSON array of strings.");
      }

      if (loadedWords.length === 0) {
        throw new Error("Word list file is empty or contains no valid words.");
      }

      words = loadedWords;
      console.log(`Successfully loaded ${words.length} words from ${filePath}`);
      return true; // Indicate success

    } catch (error) {
      console.error("Failed to load words from file:", error);
      // Display a loading error message and keep other screens hidden
      if (loadingScreen) {
        loadingScreen.innerHTML = `<p style="color: red;">${messageEl.textContent}</p>`; // Display error on loading screen
        loadingScreen.style.display = 'flex'; // Keep loading screen visible showing the error
      } else {
        // Fallback if loading screen isn't available
        alert(messageEl.textContent); // Use an alert
        messageEl.textContent = ''; // Clear the message element
      }

      if (startScreen) startScreen.style.display = 'none';
      if (gameContainer) gameContainer.style.display = 'none';
      if (gameOverScreen) gameOverScreen.style.display = 'none';

      return false; // Indicate failure
    }
  }

  // --- Screen Management ---
  function showLoadingScreen() {
    if (loadingScreen) loadingScreen.style.display = 'flex';
    if (startScreen) startScreen.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'none';
    if (gameOverScreen) gameOverScreen.style.display = 'none';
  }

  function showStartScreen(finalScore = 0) { // Optional argument to display last score
    // Ensure timer is stopped if coming from game over
    stopTimer();
    if (lastScoreSpan) {
      lastScoreSpan.textContent = finalScore; // Update last score display
    }
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (startScreen) startScreen.style.display = 'flex'; // Use flex for centering
    if (gameContainer) gameContainer.style.display = 'none';
    if (gameOverScreen) gameOverScreen.style.display = 'none';
    loadHighscores();
  }

  function showGameScreen() {
    // Ensure timer is stopped if transitioning from another screen
    stopTimer();
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (startScreen) startScreen.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'block'; // Use block for game layout
    if (gameOverScreen) gameOverScreen.style.display = 'none';

    // Ensure timer element is visible when game starts
    if (timerEl) timerEl.style.display = '';
  }

  function showGameOverScreen(finalScore, message) {
    stopTimer(); // Ensure timer is stopped

    // Update game over screen content
    if (finalScoreDisplay) finalScoreDisplay.textContent = finalScore;
    if (gameOverMessageEl) {
      gameOverMessageEl.textContent = message;
      // Add specific class if message is about a missed word vs completion
      if (message.startsWith('ލަފުޒަކީ:')) { // Check if message starts with "Word is:"
        gameOverMessageEl.className = 'incorrect'; // Use incorrect color for missed word
      } else {
        gameOverMessageEl.className = 'correct'; // Use correct color for completion
      }
    }

    // Ensure buttons are enabled
    if (gameOverPlayAgainButton) gameOverPlayAgainButton.disabled = false;
    if (gameOverGoStartButton) gameOverGoStartButton.disabled = false;


    // Transition to game over screen
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (startScreen) startScreen.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'none'; // Hide game screen
    if (gameOverScreen) gameOverScreen.style.display = 'flex'; // Use flex for centering

    saveHighscore(currentUsername, finalScore);
    Telegram.WebApp.sendData(JSON.stringify({ score: finalScore }));

    // Optional: Clear game specific UI elements after transition
    // scrambledContainer.innerHTML = '';
    // answerContainer.innerHTML = '';
    // messageEl.textContent = '';
  }


  // --- Timer Functions --- (Slightly updated to use new screen functions)
  function updateTimerDisplay() {
    if (timerSpan) {
      timerSpan.textContent = timeLeft;
      // Add/Remove CSS classes for color based on time
      if (timerEl) {
        if (timeLeft <= 5) {
          timerEl.classList.add('timer-warning');
          timerEl.classList.remove('timer-danger');
        } else if (timeLeft <= 10) {
          timerEl.classList.add('timer-danger');
          timerEl.classList.remove('timer-warning');
        }
        else {
          timerEl.classList.remove('timer-warning', 'timer-danger');
        }
      }
    }
  }

  function startTimer() {
    stopTimer();
    timeLeft = timeLimit;
    updateTimerDisplay();

    if (timerSpan) {
      timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
          handleTimeout(); // This will now trigger endGame
        }
      }, 1000);
    } else {
      console.warn("Timer display element not found, timer will not run.");
    }
  }

  function stopTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
      // Reset color when timer stops
      if (timerEl) timerEl.classList.remove('timer-warning', 'timer-danger');
    }
  }

  function handleTimeout() {
    console.log(`Timer ran out for word "${currentWord}".`);
    // Game over due to timeout - show game over screen with the missed word
    showGameOverScreen(score, `ލަފުޒަކީ: "${currentWord}"`); // Dhivehi: Word was: "..."
  }


  // --- Game Flow & State Management ---

  // Function to reset game state to initial conditions
  function resetGameState() {
    console.log("Resetting game state.");
    score = 0;
    usedWordIndices.clear(); // Clear the set of used word indices
    currentWordIndex = -1; // Reset index (setupWord will find the first word)
    currentMaxLength = difficultyLevels[0].maxLength; // Reset difficulty
    currentWord = ''; // Clear current word

    // Reset base UI elements
    scoreEl.textContent = `ސްކޯ: ${score}`;
    messageEl.textContent = '';
    messageEl.className = '';
    scrambledContainer.innerHTML = '';
    answerContainer.innerHTML = '';
    clearButton.disabled = false; // Enable clear button
  }

  // Function to start a new game (called from start screen or game over screen)
  function startGame() {
    console.log("Starting new game.");
    resetGameState(); // Reset all game state

    // Transition to game screen
    showGameScreen();

    // Start the first word setup after a small delay
    // Check if words are actually loaded before trying to set up
    if (words && words.length > 0) {
      setTimeout(setupWord, 100);
    } else {
      console.error("Cannot start game: Word list is not loaded.");
      // This case should ideally be prevented by loadWords failure handling
      showStartScreen(score); // Go back to start screen, perhaps with an error message?
      if (lastScoreSpan) lastScoreSpan.textContent = "Error"; // Indicate loading issue
    }
  }


  // Setup the word for the current round
  function setupWord() {
    // Stop any existing timer before setting up a new word
    stopTimer();
    messageEl.textContent = ''; // Clear message from previous round/timeout/correct
    messageEl.className = '';
    answerContainer.classList.remove('shake'); // Remove shake class


    // --- Word Selection based on Difficulty ---
    let nextWordIdx = -1;
    const numWords = words.length;
    const segmenter = new Intl.Segmenter('dv', { granularity: 'grapheme' });


    // First, try to find a random word that fits the current difficulty and hasn't been used
    const availableIndicesWithinDifficulty = [];
    for (let i = 0; i < numWords; i++) {
      if (!usedWordIndices.has(i)) {
        const wordGraphemes = Array.from(segmenter.segment(words[i])).map(s => s.segment);
        const wordGraphemeLength = wordGraphemes.length;

        // Check against maxLength
        if (wordGraphemeLength <= currentMaxLength) {
          availableIndicesWithinDifficulty.push(i);
        }
      }
    }

    // If there are words available at the current difficulty level
    if (availableIndicesWithinDifficulty.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableIndicesWithinDifficulty.length);
      nextWordIdx = availableIndicesWithinDifficulty[randomIndex];
      console.log(`Selected word within maxLength ${currentMaxLength}, index: ${nextWordIdx}`);

    } else {
      // If no more unused words fit the current difficulty (maxLength)
      // Check if we've used *all* words regardless of difficulty
      if (usedWordIndices.size >= numWords) {
        // Game Over: All words used
        console.log("All words in the list have been used.");
        // Show game over screen with completion message
        showGameOverScreen(score, "ސާބަސް! ހުރިހާ ލަފުޒެއް ފުރޮޅާލެވިއްޖެ"); // Dhivehi: You solved all words!
        return; // Stop setup
      } else {
        // No words fit the *current* maxLength, but there are still unused words left.
        // Pick a random word from *any* remaining unused words, regardless of length.
        console.warn(`No more unused words found with length <= ${currentMaxLength}. Picking from *any* remaining unused words.`);

        const anyAvailableIndices = [];
        for (let i = 0; i < numWords; i++) {
          if (!usedWordIndices.has(i)) {
            anyAvailableIndices.push(i);
          }
        }

        // This check should ideally pass if usedWordIndices.size < numWords
        if (anyAvailableIndices.length > 0) {
          const anyRandomIndex = Math.floor(Math.random() * anyAvailableIndices.length);
          nextWordIdx = anyAvailableIndices[anyRandomIndex];
          console.log(`Picked a random unused word outside current maxLength (${currentMaxLength}), index: ${nextWordIdx}`);
          // Optional: Inform user difficulty criteria couldn't be met for selection?
        } else {
          // This is a safeguard
          console.error("Logic error: Should have found at least one unused word.");
          showGameOverScreen(score, "މައްސަލައެއް ދިމާވެއްޖެ."); // Dhivehi: An issue occurred.
          return;
        }
      }
    }

    // --- Proceed with setting up the selected word ---

    // Mark the selected word as used
    usedWordIndices.add(nextWordIdx);

    // Set up the round with the selected word
    currentWordIndex = nextWordIdx;
    currentWord = words[currentWordIndex];

    // --- Reset UI and Create Boxes ---
    // Recalculate grapheme length for the chosen word
    const wordGraphemes = Array.from(segmenter.segment(currentWord)).map(s => s.segment);
    userAnswer = Array(wordGraphemes.length).fill(null);

    // Clear previous boxes
    scrambledContainer.innerHTML = '';
    answerContainer.innerHTML = '';
    letterElements = {};
    answerElements = [];

    // Create scrambled letter boxes using graphemes
    scrambledGraphemes = shuffleArray([...wordGraphemes]); // Use the graphemes of the selected word

    // Prevent shuffle resulting in the original word
    let attempts = 0;
    const maxShuffleAttempts = 100;
    while (scrambledGraphemes.join('') === currentWord && currentWord.length > 1 && attempts < maxShuffleAttempts) {
      scrambledGraphemes = shuffleArray([...wordGraphemes]);
      attempts++;
    }
    if (attempts === maxShuffleAttempts) {
      console.warn("Could not sufficiently scramble word after multiple attempts:", currentWord);
    }

    scrambledGraphemes.forEach((grapheme, index) => {
      const box = document.createElement('div');
      box.classList.add('letter-box');
      box.textContent = grapheme;
      box.dataset.originalIndex = index; // Store index from the *scrambled* array
      box.dataset.grapheme = grapheme;
      box.addEventListener('click', handleLetterClick);
      scrambledContainer.appendChild(box);
      letterElements[index] = box; // Store reference using its index in the *scrambled* list
    });

    // Create empty answer boxes based on grapheme count
    for (let i = 0; i < userAnswer.length; i++) {
      const box = document.createElement('div');
      box.classList.add('answer-box');
      box.dataset.answerIndex = i; // Store the index of this answer box
      box.addEventListener('click', handleAnswerBoxClick);
      answerContainer.appendChild(box);
      answerElements.push(box); // Store reference
    }

    // Ensure UI state is correct for a new word
    clearButton.disabled = false;
    clearButton.textContent = "ފޮހެލާ";
    scoreEl.textContent = `ސްކޯ: ${score}`;


    // --- Start the timer for the new word ---
    if (timerEl && timerSpan) {
      timerEl.style.display = '';
      startTimer();
    } else {
      console.warn("Timer display elements not found, timer will not run.");
    }
  }

  // Handle clicking a scrambled letter (No change needed here)
  function handleLetterClick(event) {
    const clickedBox = event.target;
    if (clickedBox.classList.contains('used')) {
      return;
    }

    const grapheme = clickedBox.dataset.grapheme;
    const originalIndex = parseInt(clickedBox.dataset.originalIndex);

    const emptyAnswerIndex = userAnswer.findIndex(slot => slot === null);

    if (emptyAnswerIndex !== -1) {
      userAnswer[emptyAnswerIndex] = { grapheme: grapheme, originalIndex: originalIndex };
      answerElements[emptyAnswerIndex].textContent = grapheme;
      answerElements[emptyAnswerIndex].classList.add('filled');
      clickedBox.classList.add('used');

      if (!userAnswer.includes(null)) {
        checkAnswer();
      }
    }
  }

  // Handle clicking an answer box (to remove the grapheme) (No change needed here)
  function handleAnswerBoxClick(event) {
    const clickedAnswerBox = event.target;
    const answerIndex = parseInt(clickedAnswerBox.dataset.answerIndex);

    if (userAnswer[answerIndex] !== null) {
      const { grapheme, originalIndex } = userAnswer[answerIndex];

      clickedAnswerBox.textContent = '';
      clickedAnswerBox.classList.remove('filled');
      userAnswer[answerIndex] = null;

      if (letterElements[originalIndex]) {
        letterElements[originalIndex].classList.remove('used');
      }

      messageEl.textContent = '';
      messageEl.className = '';
      answerContainer.classList.remove('shake');
    }
  }

  // Check if the user's answer is correct
  function checkAnswer() {
    const constructedWord = userAnswer.map(item => item ? item.grapheme : '').join('');

    if (constructedWord === currentWord) {
      // --- Correct Answer ---
      stopTimer();
      messageEl.textContent = "ރަނގަޅު!"; // "Correct!"
      messageEl.className = 'correct';
      score++;
      scoreEl.textContent = `ސްކޯ: ${score}`;

      // --- Check for Difficulty Increase ---
      let newMaxLength = currentMaxLength;
      for (const level of difficultyLevels) {
        if (score >= level.score) {
          newMaxLength = level.maxLength;
        } else {
          break;
        }
      }

      if (newMaxLength !== currentMaxLength) {
        console.log(`Difficulty level adjusted. New maximum length: ${newMaxLength}`);
        currentMaxLength = newMaxLength;
        // Optional: Inform user about difficulty change?
      }

      // Proceed to the next word after a delay
      setTimeout(setupWord, 1200);

    } else {
      // --- Incorrect Answer ---
      // Timer keeps running
      messageEl.textContent = "ރަނގަޅެއް ނޫން!"; // "Try Again!" or "Incorrect!"
      messageEl.className = 'incorrect';
      answerContainer.classList.add('shake');
      setTimeout(() => answerContainer.classList.remove('shake'), 500);
    }
  }

  // Clear the current attempt in the answer boxes (Timer keeps running)
  function clearAttempt() {
    for (let i = 0; i < userAnswer.length; i++) {
      if (userAnswer[i] !== null) {
        const { originalIndex } = userAnswer[i];

        answerElements[i].textContent = '';
        answerElements[i].classList.remove('filled');
        userAnswer[i] = null;

        if (letterElements[originalIndex]) {
          letterElements[originalIndex].classList.remove('used');
        }
      }
    }
    messageEl.textContent = '';
    messageEl.className = '';
    answerContainer.classList.remove('shake');
  }

  // Read Telegram username
  if (window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe?.user) {
    const user = Telegram.WebApp.initDataUnsafe.user;
    currentUsername = user.username || user.first_name || currentUsername;
  }

  // Save highscore to localStorage
  function saveHighscore(username, score) {
    const highscores = JSON.parse(localStorage.getItem('highscores') || '[]');
    highscores.push({ username, score });
    highscores.sort((a, b) => b.score - a.score);
    localStorage.setItem('highscores', JSON.stringify(highscores.slice(0, 10)));
  }

  // Load and display highscores
  function loadHighscores() {
    const highscores = JSON.parse(localStorage.getItem('highscores') || '[]');
    highscoreList.innerHTML = '';
    highscores.forEach(({ username, score }) => {
      const li = document.createElement('li');
      li.textContent = `${username}: ${score}`;
      highscoreList.appendChild(li);
    });
  }



  // --- Event Listeners ---
  // Listeners added within DOMContentLoaded scope
  clearButton.addEventListener('click', clearAttempt);
  startButton.addEventListener('click', startGame); // Start game from start screen
  gameOverPlayAgainButton.addEventListener('click', startGame); // Play again from game over screen
  gameOverGoStartButton.addEventListener('click', () => { // Go to start from game over
    showStartScreen(score); // Show start screen, passing the final score
    // State reset will happen when 'Start Game' is clicked on the start screen
  });


  // --- Initialisation ---
  // Initialize Telegram Web App interaction (optional)
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      // window.Telegram.WebApp.MainButton.setText('Submit Score').show().onClick(sendScore);
      console.log("Telegram WebApp SDK initialized.");
    }
  } catch (e) {
    console.error("Telegram WebApp SDK error:", e);
  }

  // --- App Startup Flow ---
  const wordListFilePath = 'words.json'; // *** Make sure this path is correct ***

  // Start by showing the loading screen
  showLoadingScreen();

  // Load words and then transition based on success/failure
  loadWords(wordListFilePath).then(success => {
    if (success) {
      // Check if we have any words that meet the initial difficulty requirement
      const segmenter = new Intl.Segmenter('dv', { granularity: 'grapheme' });
      const initialValidWords = words.filter(word =>
        Array.from(segmenter.segment(word)).map(s => s.segment).length <= difficultyLevels[0].maxLength
      );

      if (initialValidWords.length === 0) {
        // No words available to even start the first difficulty level
        messageEl.textContent = `ފެށުމަށް ބޭނުންވާ (ކުރު ${difficultyLevels[0].maxLength} އަކުރުންދަށް) ލަފުޒެއް ލިސްޓުގައި ނެތް!`; // Dhivehi: No word of initial difficulty length in list!
        messageEl.className = 'incorrect';
        // Keep loading screen visible showing the error message (handled in loadWords error)
        console.error(`Word list does not contain any words meeting the initial maximum length (${difficultyLevels[0].maxLength}). Game cannot start.`);
      } else {
        // Words loaded successfully and initial difficulty is possible
        console.log("Word list loaded. Ready to start.");
        // Show the start screen and wait for the user to click 'Start'
        showStartScreen(0); // Show start screen, initially with score 0
      }

    } else {
      // loadWords already handled displaying an error message on the loading screen.
      console.error("Game initialization failed due to word loading error.");
    }
  });
});

// Note: The CSS for shake animation, timer styling, and screen visibility (.screen, #loading-screen, etc.)
// must be in your separate CSS file (style.css) and linked in your HTML.