document.addEventListener('DOMContentLoaded', () => {
    // Check that quiz data is properly loaded
    if (typeof quizData === 'undefined' || !Array.isArray(quizData) || quizData.length === 0) {
        alert('Error: Quiz data not properly loaded. Please refresh the page or contact support.');
        console.error('Quiz data not found or invalid:', typeof quizData);
        return;
    }
    
    console.log(`Quiz data loaded successfully with ${quizData.length} questions`);
    console.log('First 3 questions:', quizData.slice(0, 3));
    console.log('Last 3 questions:', quizData.slice(-3));
    
    // DOM Elements
    const mainContainer = document.getElementById('main-container');
    const startScreen = document.getElementById('start-screen');
    const examScreen = document.getElementById('exam-screen');
    const resultsScreen = document.getElementById('results-screen');
    const warningPopup = document.getElementById('warning-popup');
    const banPopup = document.getElementById('ban-popup');
    
    const studentNameInput = document.getElementById('student-name');
    const studentIdInput = document.getElementById('student-id');
    const studentNameDisplay = document.getElementById('student-name-display');
    const studentIdDisplay = document.getElementById('student-id-display');
    
    const startExamBtn = document.getElementById('start-exam-btn');
    const prevQuestionBtn = document.getElementById('prev-question');
    const nextQuestionBtn = document.getElementById('next-question');
    const kahootNextBtn = document.getElementById('kahoot-next');
    const exitExamBtn = document.getElementById('exit-exam');
    const exitExamBanBtn = document.getElementById('exit-exam-ban');
    
    const timerValue = document.getElementById('timer-value');
    const timerBar = document.getElementById('timer-bar');
    const currentQuestion = document.getElementById('current-question');
    const totalQuestions = document.getElementById('total-questions');
    const questionCategory = document.getElementById('question-category');
    const questionStatus = document.getElementById('question-status');
    const questionText = document.getElementById('question-text');
    const answerOptions = document.getElementById('answer-options');
    const textAnswerContainer = document.getElementById('text-answer-container');
    const textAnswerInput = document.getElementById('text-answer-input');
    const submitTextAnswerBtn = document.getElementById('submit-text-answer');
    const progressBar = document.getElementById('progress-bar');
    
    const answerTypeButtons = document.querySelectorAll('.answer-type-btn');
    
    const correctCount = document.getElementById('correct-count');
    const totalCount = document.getElementById('total-count');
    const completionTime = document.getElementById('completion-time');
    const passStatus = document.getElementById('pass-status');
    const resultCode = document.getElementById('result-code');
    const copyCodeBtn = document.getElementById('copy-code');
    
    const analysisResults = document.getElementById('analysis-results');
    
    const continueExamBtn = document.getElementById('continue-exam');
    const abandonExamBtn = document.getElementById('abandon-exam');
    
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    // Exam State
    let currentState = {
        studentName: '',
        studentId: '',
        currentQuestionIndex: 0,
        userAnswers: [],
        correctAnswers: 0,
        totalQuestionsAnswered: 0,
        startTime: null,
        endTime: null,
        timePerQuestion: 30, // 30 seconds per question
        currentTimer: null,
        timeLeft: 30,
        tabSwitches: 0,
        examInProgress: false,
        answerMode: 'multiple-choice', // or 'text-input'
        banned: false,
        // Cheat detection system
        cheatDetection: {
            lastAnswerTime: null,            // For tracking rapid answers
            answerTimes: [],                 // Array to track timing of answer selections
            lastPasteTime: null,             // For paste detection
            recentMouseActivity: 0,          // Monitor mouse movements
            tabSwitchWarningCount: 0,        // Track how many tab switch warnings received
            maxAllowedTabSwitches: 2,        // Maximum number of tab switches before ban
            rapidAnswerThreshold: 500,       // Milliseconds threshold for detecting bot-like behavior
            suspicious: false                // Flag if behavior seems suspicious
        }
    };
    
    // Modify the shuffleQuestions function to ensure all questions are used
    const shuffleQuestions = (questions) => {
        // Check if we have all questions
        if (!questions || questions.length === 0) {
            console.error('No questions available in quiz data');
            return [];
        }
        
        console.log(`Shuffling all ${questions.length} questions from quiz data`);
        
        // Make sure we're working with the full array
        const shuffled = [...questions]; // Create shallow copy of the questions array
        
        // Fisher-Yates shuffle algorithm
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        console.log(`After shuffling: ${shuffled.length} questions available`);
        return shuffled;
    };
    
    const examQuestions = shuffleQuestions(quizData);
    totalQuestions.textContent = examQuestions.length;
    console.log(`Exam will use ${examQuestions.length} questions from quiz-data.js (${quizData.length} total)`);

    // Create a snapshot of the first few and last few questions for debugging
    const debugSnapshot = [
        ...examQuestions.slice(0, 3),
        ...(examQuestions.length > 6 ? ['...'] : []),
        ...examQuestions.slice(-3)
    ];
    console.log('Sample of questions to be used:', debugSnapshot);
    
    // Generate correct and incorrect options for a question
    const generateOptions = (correctAnswer) => {
        const options = [];
        
        // Clean the correct answer and split into parts
        const cleanAnswer = correctAnswer.replace(/^\d+\.\s+/gm, '')
            .replace(/\d+\)\s+/gm, '')
            .split(/(?:\.\s+|\d+\.\s+)/)
            .filter(part => part.trim().length > 0);
            
        // Add the correct answer
        options.push({
            text: correctAnswer,
            isCorrect: true
        });
        
        // Generate 3 incorrect answers by mixing parts from other questions
        const otherAnswers = examQuestions
            .filter(q => q.answer !== correctAnswer)
            .map(q => q.answer);
            
        for (let i = 0; i < 3; i++) {
            if (otherAnswers.length > 0) {
                const randomIndex = Math.floor(Math.random() * otherAnswers.length);
                const randomAnswer = otherAnswers[randomIndex];
                
                options.push({
                    text: randomAnswer,
                    isCorrect: false
                });
                
                // Remove this answer so it's not used again
                otherAnswers.splice(randomIndex, 1);
            } else {
                // Fallback if we don't have enough other answers
                options.push({
                    text: `Неправильный ответ ${i + 1}`,
                    isCorrect: false
                });
            }
        }
        
        // Shuffle the options
        return shuffleOptions(options);
    };
    
    const shuffleOptions = (options) => {
        const shuffled = [...options];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };
    
    // Display current question
    const displayQuestion = (index) => {
        const question = examQuestions[index];
        questionText.textContent = question.question;
        questionCategory.textContent = question.category || getCategoryFromQuestion(question);
        questionStatus.textContent = question.status;
        questionStatus.className = question.status === 'Обязательно' ? 'status-badge required' : 'status-badge';
        
        currentQuestion.textContent = index + 1;
        
        // Update the new question number indicators
        const currentQuestionNumber = document.getElementById('current-question-number');
        const totalQuestionCount = document.getElementById('total-question-count');
        if (currentQuestionNumber) currentQuestionNumber.textContent = index + 1;
        if (totalQuestionCount) totalQuestionCount.textContent = examQuestions.length;
        
        // Check if this question has been answered
        const currentAnswer = currentState.userAnswers[index];
        
        // Reset text input with existing value if available
        if (currentAnswer && typeof currentAnswer === 'object' && currentAnswer.text) {
            textAnswerInput.value = currentAnswer.text;
        } else if (currentAnswer && typeof currentAnswer === 'string') {
            textAnswerInput.value = currentAnswer;
        } else {
            textAnswerInput.value = '';
        }
        
        // Always show text input regardless of question type
        textAnswerContainer.classList.remove('hidden');
        
        // Always set text-input mode
        currentState.answerMode = 'text-input';
        
        // Focus on the text input for immediate typing
        setTimeout(() => {
            textAnswerInput.focus();
        }, 300);
        
        // Update navigation buttons
        prevQuestionBtn.disabled = index === 0;
        nextQuestionBtn.disabled = index >= examQuestions.length - 1;
        
        // Update progress bar
        const progress = ((index + 1) / examQuestions.length) * 100;
        progressBar.style.width = `${progress}%`;
        
        // Reset and start timer
        resetQuestionTimer();
    };
    
    // Set answer mode (multiple choice or text input)
    const setAnswerMode = (mode) => {
        currentState.answerMode = mode;
        
        // Update UI
        if (mode === 'multiple-choice') {
            answerOptions.classList.remove('hidden');
            textAnswerContainer.classList.add('hidden');
            answerTypeButtons[0].classList.add('active');
            answerTypeButtons[1].classList.remove('active');
        } else {
            answerOptions.classList.add('hidden');
            textAnswerContainer.classList.remove('hidden');
            answerTypeButtons[0].classList.remove('active');
            answerTypeButtons[1].classList.add('active');
        }
    };
    
    // Infer category from question if not already set
    const getCategoryFromQuestion = (question) => {
        const q = question.question.toLowerCase();
        if (q.includes("ук") || q.includes("преступлен") || q.includes("штраф") || q.includes("статья")) {
            return "Уголовный кодекс";
        } else if (q.includes("дк") || q.includes("движен") || q.includes("парков")) {
            return "Административный + Дорожный кодексы";
        } else if (q.includes("пк") || q.includes("допрос") || q.includes("миранд") || q.includes("адвокат")) {
            return "Процессуальный кодекс";
        } else if (q.includes("lscsd") || q.includes("шериф")) {
            return "Устав LSCSD";
        } else {
            return "Законы";
        }
    };
    
    // Timer functions
    const startQuestionTimer = () => {
        currentState.timeLeft = currentState.timePerQuestion;
        updateTimerDisplay();
        
        currentState.currentTimer = setInterval(() => {
            currentState.timeLeft--;
            updateTimerDisplay();
            
            // Update timer bar width
            const progressPercentage = (currentState.timeLeft / currentState.timePerQuestion) * 100;
            timerBar.style.width = `${progressPercentage}%`;
            
            if (currentState.timeLeft <= 10) {
                timerValue.parentElement.classList.add('warning');
            }
            
            if (currentState.timeLeft <= 5) {
                timerValue.parentElement.classList.remove('warning');
                timerValue.parentElement.classList.add('danger');
            }
            
            if (currentState.timeLeft <= 0) {
                clearInterval(currentState.currentTimer);
                // Time's up for this question
                if (currentState.currentQuestionIndex < examQuestions.length - 1) {
                    goToNextQuestion();
                } else {
                    finishExam();
                }
            }
        }, 1000);
    };
    
    const resetQuestionTimer = () => {
        clearInterval(currentState.currentTimer);
        timerValue.parentElement.classList.remove('warning', 'danger');
        currentState.timeLeft = currentState.timePerQuestion;
        updateTimerDisplay();
        
        // Reset timer bar
        timerBar.style.width = '100%';
        
        startQuestionTimer();
    };
    
    const updateTimerDisplay = () => {
        timerValue.textContent = `00:${currentState.timeLeft.toString().padStart(2, '0')}`;
    };
    
    const formatTotalTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };
    
    // Navigation functions
    const goToNextQuestion = () => {
        // Stop the current timer
        clearInterval(currentState.timerInterval);
        
        // Check if we're at the end of the exam
        if (currentState.currentQuestionIndex >= examQuestions.length - 1) {
            finishExam();
            return;
        }
        
        // Move to the next question
        currentState.currentQuestionIndex++;
        
        // Display the next question
        displayQuestion(currentState.currentQuestionIndex);
        
        // Show animation to indicate progression
        const questionElement = document.querySelector('.question-wrapper');
        questionElement.classList.add('kahoot-pop');
        setTimeout(() => {
            questionElement.classList.remove('kahoot-pop');
        }, 500);

        // Start the timer for the new question
        resetQuestionTimer();
        updateProgressBar();
    };
    
    // Add missing updateProgressBar function
    const updateProgressBar = () => {
        // Update the progress bar based on current question index
        const progress = ((currentState.currentQuestionIndex + 1) / examQuestions.length) * 100;
        progressBar.style.width = `${progress}%`;
        
        // Also update the question counter for clarity
        const answeredCount = currentState.userAnswers.filter(answer => answer).length;
        const progressIndicator = document.querySelector('.navigation-buttons');
        if (progressIndicator) {
            progressIndicator.style.display = 'flex'; // Make sure navigation is visible
        }
        
        // Show clear message about remaining questions
        console.log(`Question ${currentState.currentQuestionIndex + 1} of ${examQuestions.length} (${answeredCount} answered)`);
    };
    
    const goToPrevQuestion = () => {
        // Save text answer if in text mode
        if (currentState.answerMode === 'text-input') {
            saveTextAnswer();
        }
        
        if (currentState.currentQuestionIndex > 0) {
            currentState.currentQuestionIndex--;
            displayQuestion(currentState.currentQuestionIndex);
        }
    };
    
    // Save text answer
    const saveTextAnswer = () => {
        const index = currentState.currentQuestionIndex;
        const textValue = textAnswerInput.value.trim();
        
        if (textValue) {
            // Store just the text value
            currentState.userAnswers[index] = textValue;
        }
    };
    
    // Ban the user for cheating
    const banUser = (reason) => {
        if (currentState.banned) return; // Avoid multiple ban calls
        
        currentState.banned = true;
        clearInterval(currentState.currentTimer);
        currentState.examInProgress = false;
        
        // Record the time when banned
        currentState.endTime = new Date();
        
        // Hide any active warning
        warningPopup.classList.remove('active');
        
        // Set ban message
        document.getElementById('ban-message').textContent = reason;
        
        // Show ban popup
        banPopup.classList.add('active');
        
        // Log the ban (in a real application, this might send data to a server)
        console.log('User banned:', {
            student: {
                name: currentState.studentName,
                id: currentState.studentId
            },
            reason: reason,
            tabSwitches: currentState.tabSwitches,
            timestamp: new Date().toISOString()
        });
    };
    
    // Check for multiple cheating patterns
    const checkForCheating = () => {
        // Check if already banned
        if (currentState.banned) return;
        
        // If they've switched tabs too many times
        if (currentState.tabSwitches > currentState.cheatDetection.maxAllowedTabSwitches) {
            banUser(`Вы переключились на другую вкладку ${currentState.tabSwitches} раз(а). Это нарушение правил экзамена.`);
            return true;
        }
        
        // Check for impossible speed in answering
        if (currentState.cheatDetection.answerTimes.length >= 3) {
            // Get the last 3 answer times
            const lastThree = currentState.cheatDetection.answerTimes.slice(-3);
            // Check the intervals between them
            const interval1 = lastThree[1] - lastThree[0];
            const interval2 = lastThree[2] - lastThree[1];
            
            // If both intervals are suspiciously short, likely bot activity
            if (interval1 < currentState.cheatDetection.rapidAnswerThreshold && 
                interval2 < currentState.cheatDetection.rapidAnswerThreshold) {
                banUser('Обнаружена подозрительная активность: слишком быстрые ответы. Возможно использование бота или скрипта.');
                return true;
            }
        }
        
        // Additional check: If suspicious flag is set by other detections
        if (currentState.cheatDetection.suspicious) {
            banUser('Обнаружена подозрительная активность. Экзамен прерван.');
            return true;
        }
        
        return false;
    };
    
    // Tab visibility management
    const handleVisibilityChange = () => {
        if (currentState.examInProgress) {
            if (document.hidden) {
                // User switched tabs or minimized
                currentState.tabSwitches++;
                clearInterval(currentState.currentTimer);
                
                // Show warning on return
                document.addEventListener('visibilitychange', handleVisibilityReturn, { once: true });
                
                // Check for potential ban condition right away
                if (currentState.tabSwitches > currentState.cheatDetection.maxAllowedTabSwitches) {
                    banUser(`Вы переключились на другую вкладку ${currentState.tabSwitches} раз(а). Это нарушение правил экзамена.`);
                }
            }
        }
    };
    
    const handleVisibilityReturn = () => {
        if (!document.hidden && currentState.examInProgress && !currentState.banned) {
            currentState.cheatDetection.tabSwitchWarningCount++;
            
            warningPopup.classList.add('active');
            document.getElementById('warning-message').textContent = 
                `Вы переключились на другую вкладку ${currentState.tabSwitches} раз(а). Это нарушение правил экзамена. Продолжение приведет к штрафу времени. Еще ${currentState.cheatDetection.maxAllowedTabSwitches - currentState.tabSwitches + 1} нарушение(я) приведет к отстранению от экзамена.`;
        }
    };
    
    // Finish exam and calculate results - update to handle string answers
    const finishExam = async () => {
        // Save the last text answer
        saveTextAnswer();
        
        clearInterval(currentState.currentTimer);
        currentState.examInProgress = false;
        currentState.endTime = new Date();
        
        // Calculate the total time taken in seconds
        const totalTimeSeconds = Math.floor((currentState.endTime - currentState.startTime) / 1000);
        completionTime.textContent = formatTotalTime(totalTimeSeconds);
        
        // Analyze answers - modified to handle string answers
        const results = {
            student: {
                name: currentState.studentName,
                id: currentState.studentId
            },
            questions: [],
            tabSwitches: currentState.tabSwitches,
            totalTime: totalTimeSeconds,
            timestamp: new Date().toISOString(),
            banned: currentState.banned
        };
        
        let correctAnswersCount = 0;
        const totalAnsweredQuestions = currentState.userAnswers.filter(answer => answer).length;
        
        examQuestions.forEach((question, index) => {
            const userAnswer = currentState.userAnswers[index];
            let isCorrect = false;
            let answerText = "Не ответил";
            
            if (userAnswer) {
                if (typeof userAnswer === 'object' && userAnswer.text) {
                    // Handle legacy answer format from previous sessions
                    answerText = userAnswer.text;
                    isCorrect = userAnswer.isCorrect;
                } else if (typeof userAnswer === 'string') {
                    // New format: just the text
                    answerText = userAnswer;
                    
                    // Simple similarity check with the correct answer
                    const correctAnswer = question.answer;
                    isCorrect = checkTextAnswerSimilarity(userAnswer, correctAnswer);
                }
            }
            
            if (isCorrect) correctAnswersCount++;
            
            results.questions.push({
                question: question.question,
                correctAnswer: question.answer,
                userAnswer: answerText,
                isCorrect: isCorrect,
                status: question.status,
                category: question.category || getCategoryFromQuestion(question)
            });
        });
        
        results.correctCount = correctAnswersCount;
        results.totalQuestions = examQuestions.length;
        results.percentage = Math.round((correctAnswersCount / examQuestions.length) * 100);
        results.answeredQuestions = totalAnsweredQuestions;
        
        // If the student was banned, mark it clearly in the results
        if (currentState.banned) {
            results.banned = true;
            results.banReason = document.getElementById('ban-message').textContent;
        }
        
        // Update results screen
        correctCount.textContent = correctAnswersCount;
        totalCount.textContent = examQuestions.length;
        
        // Rest of the function remains the same...
        try {
            // Use a safe encode function that handles Unicode characters
            function safeEncode(obj) {
                try {
                    // Convert the object to a JSON string
                    const jsonString = JSON.stringify(obj);
                    
                    // Encode UTF-8 data in a way that works with the teacher's site
                    // Convert string to UTF-8 bytes, then encode as base64
                    const utf8Encoder = new TextEncoder(); // UTF-8 encoder
                    const utf8Bytes = utf8Encoder.encode(jsonString);
                    
                    // Convert UTF-8 bytes to a plain string that can be base64 encoded
                    let binaryString = '';
                    utf8Bytes.forEach(byte => {
                        binaryString += String.fromCharCode(byte);
                    });
                    
                    // Finally, encode as base64
                    return btoa(binaryString);
                } catch (error) {
                    console.error("Encoding error:", error);
                    
                    // Fallback - just use the normal JSON.stringify with btoa
                    try {
                        return btoa(JSON.stringify(obj));
                    } catch (fallbackError) {
                        console.error("Fallback encoding failed:", fallbackError);
                        throw new Error("Failed to encode results");
                    }
                }
            }
            
            // Encode results safely with Unicode support
            const resultCodeValue = safeEncode(results);
            resultCode.value = resultCodeValue;
            
            // Show pass/fail status
            const passThreshold = 70;
            if (currentState.banned) {
                passStatus.textContent = 'Не сдал (Отстранен)';
                passStatus.style.color = 'var(--incorrect-color)';
            } else if (results.percentage >= passThreshold) {
                passStatus.textContent = 'Сдал';
                passStatus.style.color = 'var(--correct-color)';
            } else {
                passStatus.textContent = 'Не сдал';
                passStatus.style.color = 'var(--incorrect-color)';
            }
            
            try {
                // Batch questions into 4 groups for Gemini API to reduce calls
                const batchSize = Math.ceil(results.questions.length / 4);
                const batches = [];
                
                // Split questions into 4 batches
                for (let i = 0; i < results.questions.length; i += batchSize) {
                    batches.push(results.questions.slice(i, i + batchSize));
                }
                
                // Process each batch with Gemini API
                let allComparisons = [];
                let failedBatches = [];
                
                // Show loading indicator with batch progress
                document.querySelector('.loading-text').textContent = 'Анализ ваших ответов (0/4)...';
                
                // Initial processing of the 4 batches
                for (let i = 0; i < batches.length; i++) {
                    const batchResults = { ...results, questions: batches[i] };
                    
                    // Update loading text with current batch progress
                    document.querySelector('.loading-text').textContent = `Анализ ваших ответов (${i+1}/4)...`;
                    
                    try {
                        // Call Gemini API for this batch
                        const batchAnalysis = await window.geminiAPI.analyzeAnswers(batchResults);
                        
                        // If the batch was processed successfully, add its comparisons
                        if (batchAnalysis && batchAnalysis.comparisons) {
                            allComparisons = [...allComparisons, ...batchAnalysis.comparisons];
                        } else {
                            // If processing failed, add to failed batches
                            failedBatches.push(batches[i]);
                        }
                    } catch (batchError) {
                        console.error(`Error processing batch ${i+1}:`, batchError);
                        failedBatches.push(batches[i]);
                    }
                }
                
                // Try to process any failed batches with up to 2 additional API calls
                if (failedBatches.length > 0 && failedBatches.length <= 2) {
                    document.querySelector('.loading-text').textContent = 'Повторный анализ некоторых ответов...';
                    
                    for (let i = 0; i < failedBatches.length; i++) {
                        const retryBatchResults = { ...results, questions: failedBatches[i] };
                        
                        try {
                            // Additional API call for retry
                            document.querySelector('.loading-text').textContent = `Повторный анализ (${i+1}/${failedBatches.length})...`;
                            const retryAnalysis = await window.geminiAPI.analyzeAnswers(retryBatchResults);
                            
                            if (retryAnalysis && retryAnalysis.comparisons) {
                                allComparisons = [...allComparisons, ...retryAnalysis.comparisons];
                            }
                        } catch (retryError) {
                            console.error(`Retry failed for batch:`, retryError);
                            // No further retry attempts - let the fallback evaluations handle it
                        }
                    }
                }
                
                // Sort comparisons by question number to ensure correct order
                allComparisons.sort((a, b) => a.questionNumber - b.questionNumber);
                
                // Create final analysis result with all comparisons
                const geminiAnalysis = {
                    comparisons: allComparisons,
                    adjustedScore: {
                        correct: correctAnswersCount,
                        total: results.totalQuestions,
                        percentage: results.percentage,
                        isPassing: results.percentage >= 70
                    },
                    timestamp: new Date().toISOString()
                };
                
                displayGeminiAnalysis(geminiAnalysis);
            } catch (geminiError) {
                console.error('Error calling Gemini API:', geminiError);
                // Show error in analysis section but continue with the rest of the function
                displayGeminiError('Ошибка при анализе ответов через Gemini API. Это не влияет на ваши результаты.');
            }
        } catch (error) {
            console.error('Error processing results:', error);
            resultCode.value = 'Ошибка генерации кода результата. Пожалуйста, сделайте скриншот экрана и отправьте преподавателю.';
            
            // Show error in analysis section
            displayGeminiError('Произошла ошибка при обработке результатов. Это не влияет на ваши ответы.');
        }
        
        // Switch to results screen
        examScreen.classList.remove('active');
        examScreen.classList.add('hidden');
        resultsScreen.classList.remove('hidden');
        resultsScreen.classList.add('active');
    };
    
    // Add the text similarity function back since we need it for evaluation
    const checkTextAnswerSimilarity = (userAnswer, correctAnswer) => {
        // Special case for article numbers or law references
        if (isArticleNumberAnswer(userAnswer, correctAnswer)) {
            return true;
        }
        
        // Simple concept-based evaluation similar to our AI approach
        
        // Clean answers
        const cleanUserAnswer = userAnswer.toLowerCase().trim();
        const cleanCorrectAnswer = correctAnswer.toLowerCase().trim();
        
        // Check for empty answers
        if (!cleanUserAnswer) return false;
        
        // Extract key terms from the correct answer
        const correctTerms = cleanCorrectAnswer
            .split(/\s+/)
            .filter(term => term.length > 4 && !isCommonWord(term));
        
        // Check how many key terms are in the user's answer
        let matchCount = 0;
        correctTerms.forEach(term => {
            if (cleanUserAnswer.includes(term)) {
                matchCount++;
            }
        });
        
        // Calculate coverage - what percentage of key terms are matched
        const coverage = correctTerms.length > 0 ? 
            matchCount / correctTerms.length : 0;
        
        // Check for contradictions that would make the answer wrong
        const hasContradictions = checkForContradictions(cleanUserAnswer, cleanCorrectAnswer);
        
        // Consider it correct if at least 70% of key terms are included and no contradictions
        return coverage >= 0.7 && !hasContradictions;
    };
    
    // Check if the answer is a correct article number or legal code reference
    const isArticleNumberAnswer = (userAnswer, correctAnswer) => {
        // Clean and normalize the answers
        const cleanUserAnswer = userAnswer.trim().toLowerCase().replace(/\s+/g, "");
        const cleanCorrectAnswer = correctAnswer.trim().toLowerCase();
        
        // Extract possible article numbers from the correct answer
        const articlePattern = /(\d+\.?\d*)/g;
        const correctMatches = correctAnswer.match(articlePattern) || [];
        
        // Common legal code abbreviations
        const legalCodes = ["ук", "ч", "ст", "п", "кап", "статья", "гк", "коап", "упк", "тк"];
        
        // Check if user answer contains a legal code abbreviation
        const hasLegalCode = legalCodes.some(code => 
            cleanUserAnswer.includes(code.toLowerCase())
        );
        
        // Check if the user answer includes article numbers from the correct answer
        const hasCorrectArticle = correctMatches.some(match => 
            cleanUserAnswer.includes(match)
        );
        
        // Check if answer appears to be just an article number
        const isArticleNumber = /^\d+\.?\d*$/.test(cleanUserAnswer);
        
        // If the user just wrote a number that appears in the correct answer
        if (isArticleNumber && correctMatches.includes(cleanUserAnswer)) {
            return true;
        }
        
        // Check if the answer contains both a legal code reference and correct number
        if (hasLegalCode && hasCorrectArticle) {
            return true;
        }
        
        // Special case for "17.11" type answers when that exact text is in the correct answer
        if (cleanCorrectAnswer.includes(cleanUserAnswer) && 
            (cleanUserAnswer.includes(".") || hasLegalCode)) {
            return true;
        }
        
        return false;
    };
    
    // Helper to check if a word is common
    const isCommonWord = (word) => {
        const commonWords = [
            'этот', 'того', 'быть', 'весь', 'этот', 'один', 'такой', 'свой',
            'наш', 'ваш', 'мочь', 'если', 'когда', 'только', 'также'
        ];
        return commonWords.includes(word);
    };
    
    // Check for contradictions in the answer
    const checkForContradictions = (userAnswer, correctAnswer) => {
        const negationWords = ['не', 'нет', 'нельзя', 'никогда'];
        
        // Simple check for negation words that might contradict
        for (const word of negationWords) {
            if (userAnswer.includes(word) && !correctAnswer.includes(word)) {
                return true;
            }
        }
        
        // Check for opposite pairs
        const oppositePairs = [
            ['разрешено', 'запрещено'], 
            ['можно', 'нельзя'],
            ['всегда', 'никогда']
        ];
        
        for (const [term1, term2] of oppositePairs) {
            if ((correctAnswer.includes(term1) && userAnswer.includes(term2)) ||
                (correctAnswer.includes(term2) && userAnswer.includes(term1))) {
                return true;
            }
        }
        
        return false;
    };
    
    // Update the displayGeminiAnalysis function to better handle the comparison results
    const displayGeminiAnalysis = (response) => {
        // Hide loading indicators
        document.querySelector('.loading-text').classList.add('hidden');
        document.querySelector('.loading-spinner').classList.add('hidden');
        
        // Show results section
        analysisResults.classList.remove('hidden');
        
        // Create HTML content for comparisons
        const comparisonsHTML = response.comparisons
            .map(comp => {
                // Determine color class based on comparison category
                let scoreClass;
                if (comp.comparison === 'Правильно') {
                    scoreClass = 'correct';
                } else if (comp.comparison === 'Частично правильно') {
                    scoreClass = 'partially-correct';
                } else {
                    scoreClass = 'incorrect';
                }
                
                return `
                <div class="comparison-item ${scoreClass}">
                    <div class="comparison-question">
                        <strong>Вопрос ${comp.questionNumber}:</strong> ${comp.question}
                    </div>
                    <div class="comparison-answers">
                        <div class="user-answer">
                            <strong>Ваш ответ:</strong> ${comp.userAnswer || 'Нет ответа'}
                        </div>
                    </div>
                    <div class="comparison-result ${scoreClass}">
                        <span class="evaluation-badge">${comp.comparison}</span>
                        <span class="score-badge">${comp.similarityScore}%</span>
                    </div>
                    <div class="reason-explanation">
                        <strong>Причина:</strong> ${comp.reasonExplanation || 'Нет объяснения'}
                    </div>
                </div>
                `;
            })
            .join('');
        
        // Create adjusted score section
        const { correct, total, percentage, isPassing } = response.adjustedScore;
        const scoreStatusClass = isPassing ? 'pass' : 'fail';
        
        const scoreHTML = `
        <div class="adjusted-score ${scoreStatusClass}">
            <h4>Итоговая оценка</h4>
            <div class="score-value">
                <span class="large-score">${percentage}%</span>
                <span class="score-fraction">${correct}/${total}</span>
            </div>
            <div class="pass-fail-indicator ${scoreStatusClass}">
                ${isPassing ? 'СДАЛ' : 'НЕ СДАЛ'}
            </div>
        </div>
        `;
        
        // Combine everything
        analysisResults.innerHTML = `
        <h4>Сравнение ответов</h4>
        <p class="comparison-explanation">
            Система сравнила ваши ответы с правильными и оценила степень соответствия
        </p>
        ${scoreHTML}
        <div class="comparisons-list">
            ${comparisonsHTML}
        </div>
        `;
        
        // Add CSS styles for the new comparison UI
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .comparison-item {
                background-color: var(--card-bg);
                border-radius: 10px;
                padding: 15px;
                margin-bottom: 15px;
                border-left: 4px solid var(--neutral-color);
            }
            .comparison-item.correct {
                border-left-color: var(--correct-color);
            }
            .comparison-item.partially-correct {
                border-left-color: #FFC107;
            }
            .comparison-item.incorrect {
                border-left-color: var(--incorrect-color);
            }
            .comparison-question {
                margin-bottom: 10px;
            }
            .comparison-answers {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 10px;
                padding: 10px;
                background-color: rgba(0,0,0,0.1);
                border-radius: 8px;
            }
            .user-answer {
                padding: 5px;
                border-radius: 4px;
            }
            .comparison-result {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 10px;
            }
            .comparison-result.correct {
                color: var(--correct-color);
            }
            .comparison-result.partially-correct {
                color: #FFC107;
            }
            .comparison-result.incorrect {
                color: var(--incorrect-color);
            }
            .score-badge {
                background-color: var(--secondary-bg);
                padding: 4px 8px;
                border-radius: 20px;
                font-weight: bold;
                font-size: 0.9em;
            }
            .evaluation-badge {
                background-color: var(--primary-color);
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-weight: bold;
                font-size: 0.9em;
            }
            .comparison-result.correct .evaluation-badge {
                background-color: var(--correct-color);
            }
            .comparison-result.partially-correct .evaluation-badge {
                background-color: #FFC107;
                color: #333;
            }
            .comparison-result.incorrect .evaluation-badge {
                background-color: var(--incorrect-color);
            }
            .reason-explanation {
                background-color: rgba(255,255,255,0.05);
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 0.9em;
            }
            .adjusted-score {
                text-align: center;
                margin: 20px 0;
                padding: 20px;
                background-color: var(--card-bg);
                border-radius: 10px;
            }
            .score-value {
                margin: 15px 0;
            }
            .large-score {
                font-size: 2.5rem;
                font-weight: bold;
            }
            .score-fraction {
                font-size: 1.2rem;
                margin-left: 10px;
                opacity: 0.7;
            }
            .pass-fail-indicator {
                display: inline-block;
                padding: 8px 20px;
                border-radius: 20px;
                font-weight: bold;
                margin-top: 10px;
            }
            .pass-fail-indicator.pass {
                background-color: var(--correct-color);
                color: white;
            }
            .pass-fail-indicator.fail {
                background-color: var(--incorrect-color);
                color: white;
            }
            .comparison-explanation {
                text-align: center;
                color: var(--muted-text);
                margin-bottom: 20px;
            }
        `;
        document.head.appendChild(styleElement);
    };
    
    // Update the error display function to match the new comparison UI
    const displayGeminiError = (errorMessage) => {
        // Hide loading indicators
        document.querySelector('.loading-text').classList.add('hidden');
        document.querySelector('.loading-spinner').classList.add('hidden');
        
        // Show analysis results
        analysisResults.classList.remove('hidden');
        
        // Create simple error message matching the new UI style
        analysisResults.innerHTML = `
            <h4>Результат проверки ответов</h4>
            <div class="comparison-error">
                <i class="bi bi-exclamation-circle"></i>
                <p>${errorMessage}</p>
                <p class="error-note">Ваши ответы были сохранены, проверка будет произведена преподавателем.</p>
            </div>
        `;
        
        // Add CSS for the error message to match the new UI
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .comparison-error {
                text-align: center;
                padding: 30px;
                background-color: var(--card-bg);
                border-radius: 10px;
                margin: 20px 0;
            }
            
            .comparison-error i {
                font-size: 2.5rem;
                color: var(--kahoot-yellow);
                margin-bottom: 15px;
                display: block;
            }
            
            .error-note {
                margin-top: 15px;
                font-size: 0.9em;
                color: var(--muted-text);
            }
        `;
        document.head.appendChild(styleElement);
    };
    
    // Event Listeners
    startExamBtn.addEventListener('click', () => {
        const studentName = studentNameInput.value.trim();
        const studentId = studentIdInput.value.trim();
        
        if (!studentName || !studentId) {
            alert('Пожалуйста, заполните все поля перед началом экзамена.');
            return;
        }
        
        // Set up exam state
        currentState.studentName = studentName;
        currentState.studentId = studentId;
        currentState.userAnswers = new Array(examQuestions.length);
        currentState.startTime = new Date();
        currentState.examInProgress = true;
        currentState.banned = false;
        
        // Show a notification that all questions are being used
        const notification = document.createElement('div');
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = 'var(--primary-color)';
        notification.style.color = 'white';
        notification.style.padding = '12px 20px';
        notification.style.borderRadius = '8px';
        notification.style.zIndex = '9999';
        notification.style.fontWeight = 'bold';
        notification.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
        notification.textContent = `Экзамен включает ${examQuestions.length} вопросов из базы данных`;
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 5000);
        
        // Reset cheat detection system
        currentState.cheatDetection = {
            lastAnswerTime: null,
            answerTimes: [],
            lastPasteTime: null,
            recentMouseActivity: 0,
            tabSwitchWarningCount: 0,
            maxAllowedTabSwitches: 2,
            rapidAnswerThreshold: 500,
            suspicious: false
        };
        
        // Display student info
        studentNameDisplay.textContent = studentName;
        studentIdDisplay.textContent = `ID: ${studentId}`;
        
        // Switch to exam screen
        startScreen.classList.remove('active');
        startScreen.classList.add('hidden');
        examScreen.classList.remove('hidden');
        examScreen.classList.add('active');
        
        // Create hidden cheat button for random answers
        createCheatButton();
        
        // Display first question
        currentState.currentQuestionIndex = 0;
        displayQuestion(0);
        
        // Initialize the progress bar
        updateProgressBar();
        
        // Start monitoring tab visibility
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Add copy-paste detection for text answers
        textAnswerInput.addEventListener('paste', (e) => {
            // Prevent pasting completely
            e.preventDefault();
            e.stopPropagation();
            
            // Show a warning notification that pasting is not allowed
            const notification = document.createElement('div');
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.left = '50%';
            notification.style.transform = 'translateX(-50%)';
            notification.style.backgroundColor = 'var(--kahoot-red)';
            notification.style.color = 'white';
            notification.style.padding = '12px 20px';
            notification.style.borderRadius = '8px';
            notification.style.zIndex = '9999';
            notification.style.fontWeight = 'bold';
            notification.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
            notification.textContent = 'Вставка текста запрещена!';
            document.body.appendChild(notification);
            
            // Remove notification after 3 seconds
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 3000);
        });
        
        // Add global mouse movement tracking to detect automation
        let lastMouseX = 0, lastMouseY = 0;
        document.addEventListener('mousemove', (e) => {
            // Check for unnatural mouse movements (straight lines, no human-like curves)
            const diffX = Math.abs(e.clientX - lastMouseX);
            const diffY = Math.abs(e.clientY - lastMouseY);
            
            if (diffX > 0 || diffY > 0) {
                currentState.cheatDetection.recentMouseActivity++;
            }
            
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        });
    });
    
    // Update displayQuestion function to add tracking of answer selection time
    const originalOptionListener = answerOptions.addEventListener;
    answerOptions.addEventListener = function(event, listener, options) {
        if (event === 'click') {
            const wrappedListener = (e) => {
                // Record the time of the answer selection
                const now = Date.now();
                currentState.cheatDetection.answerTimes.push(now);
                
                // Check for suspicious rapid clicking
                if (currentState.cheatDetection.lastAnswerTime) {
                    const timeDiff = now - currentState.cheatDetection.lastAnswerTime;
                    if (timeDiff < currentState.cheatDetection.rapidAnswerThreshold) {
                        // Increment suspicion counter
                        currentState.cheatDetection.suspicious = true;
                        checkForCheating();
                    }
                }
                
                currentState.cheatDetection.lastAnswerTime = now;
                
                // Call the original listener
                listener(e);
            };
            
            return originalOptionListener.call(this, event, wrappedListener, options);
        }
        
        return originalOptionListener.call(this, event, listener, options);
    };
    
    // Answer type toggle
    answerTypeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Save current answer if switching from text input
            if (currentState.answerMode === 'text-input') {
                saveTextAnswer();
            }
            
            const mode = btn.dataset.type;
            setAnswerMode(mode);
        });
    });
    
    // Submit text answer
    submitTextAnswerBtn.addEventListener('click', () => {
        saveTextAnswer();
        
        // Record answer time for cheat detection
        const now = Date.now();
        currentState.cheatDetection.answerTimes.push(now);
        
        // Show visual feedback
        submitTextAnswerBtn.innerHTML = '<i class="bi bi-check-circle"></i> Сохранено';
        submitTextAnswerBtn.style.backgroundColor = 'var(--correct-color)';
        
        // Wait a moment to show the confirmation
        setTimeout(() => {
            submitTextAnswerBtn.innerHTML = '<i class="bi bi-check-lg"></i> Ответить';
            submitTextAnswerBtn.style.backgroundColor = '';
            
            // Automatically go to next question or finish exam
            if (currentState.currentQuestionIndex < examQuestions.length - 1) {
                goToNextQuestion();
            } else {
                finishExam();
            }
        }, 800);
    });
    
    // Navigation
    prevQuestionBtn.addEventListener('click', goToPrevQuestion);
    kahootNextBtn.addEventListener('click', goToNextQuestion);
    
    continueExamBtn.addEventListener('click', () => {
        warningPopup.classList.remove('active');
        // Penalty: reduce time for this question
        currentState.timeLeft = Math.max(5, currentState.timeLeft - 10); // Minimum 5 seconds remaining
        updateTimerDisplay();
        startQuestionTimer();
        
        // Check if they've received too many warnings and should be banned
        if (currentState.cheatDetection.tabSwitchWarningCount >= 3) {
            banUser('Слишком много предупреждений о переключении вкладок. Экзамен прерван.');
        }
    });
    
    abandonExamBtn.addEventListener('click', finishExam);
    
    exitExamBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    exitExamBanBtn.addEventListener('click', () => {
        // If the user was banned, show the results screen
        if (currentState.banned) {
            // Hide ban popup
            banPopup.classList.remove('active');
            // Finish exam to show results
            finishExam();
        } else {
            // Just go back to index if somehow not banned
            window.location.href = 'index.html';
        }
    });
    
    copyCodeBtn.addEventListener('click', () => {
        resultCode.select();
        document.execCommand('copy');
        
        copyCodeBtn.innerHTML = '<i class="bi bi-check"></i>';
        copyCodeBtn.classList.add('copied');
        
        setTimeout(() => {
            copyCodeBtn.innerHTML = '<i class="bi bi-clipboard"></i>';
            copyCodeBtn.classList.remove('copied');
        }, 2000);
    });
    
    // Theme toggle
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        document.body.classList.toggle('dark-theme');
        
        // Toggle icon
        const icon = themeToggleBtn.querySelector('i');
        if (icon.classList.contains('bi-moon-fill')) {
            icon.classList.replace('bi-moon-fill', 'bi-sun-fill');
        } else {
            icon.classList.replace('bi-sun-fill', 'bi-moon-fill');
        }
    });
    
    // Handle page unload attempt
    window.addEventListener('beforeunload', (e) => {
        if (currentState.examInProgress) {
            // Standard approach to show confirmation dialog
            e.preventDefault();
            e.returnValue = '';
            
            // This message may not be displayed in modern browsers, 
            // but we still need to return a non-empty string
            return 'Вы уверены, что хотите покинуть экзамен? Ваши ответы не будут сохранены.';
        }
    });
    
    // Add hidden cheat button for random answers
    const createCheatButton = () => {
        // Check if the button already exists
        if (document.querySelector('.cheat-button')) {
            return;
        }
        
        // Create the hidden button
        const cheatButton = document.createElement('button');
        cheatButton.className = 'cheat-button';
        cheatButton.id = 'cheat-button';
        cheatButton.setAttribute('aria-hidden', 'true');
        document.body.appendChild(cheatButton);
        
        // Add event listener to the cheat button
        cheatButton.addEventListener('click', () => {
            // Generate random answers for all questions except the last one
            for (let i = 0; i < examQuestions.length - 1; i++) {
                // Get the current question
                const question = examQuestions[i];
                
                // Decide how to generate a random answer
                const randomMethod = Math.floor(Math.random() * 4); // 0-3
                
                let randomAnswer = "";
                
                switch (randomMethod) {
                    case 0:
                        // Use part of the correct answer to simulate partial knowledge
                        const correctParts = question.answer.split(/[.;:,]\s+/);
                        if (correctParts.length > 1) {
                            // Take a random subset of parts from the correct answer
                            const numParts = Math.floor(Math.random() * correctParts.length) + 1;
                            const selectedParts = [];
                            for (let j = 0; j < numParts; j++) {
                                const randomPart = correctParts[Math.floor(Math.random() * correctParts.length)];
                                if (!selectedParts.includes(randomPart)) {
                                    selectedParts.push(randomPart);
                                }
                            }
                            randomAnswer = selectedParts.join(". ");
                        } else {
                            // Use a portion of the correct answer
                            const words = question.answer.split(" ");
                            const startIndex = Math.floor(Math.random() * (words.length / 2));
                            const endIndex = startIndex + Math.floor(Math.random() * (words.length - startIndex)) + 1;
                            randomAnswer = words.slice(startIndex, endIndex).join(" ");
                        }
                        break;
                    
                    case 1:
                        // Use a completely different answer from another question
                        const otherQuestions = quizData.filter(q => q !== question);
                        if (otherQuestions.length > 0) {
                            const randomQuestion = otherQuestions[Math.floor(Math.random() * otherQuestions.length)];
                            randomAnswer = randomQuestion.answer;
                        } else {
                            randomAnswer = "Не знаю ответа на этот вопрос";
                        }
                        break;
                    
                    case 2:
                        // Use a modified version of the correct answer (with errors)
                        const correctAnswer = question.answer;
                        // Replace some words with alternatives or misspell them
                        const words = correctAnswer.split(" ");
                        words.forEach((word, index) => {
                            if (Math.random() < 0.3 && word.length > 4) {
                                // Either replace with a similar word or introduce a typo
                                if (Math.random() < 0.5) {
                                    // Typo
                                    const charToChange = Math.floor(Math.random() * (word.length - 1)) + 1;
                                    words[index] = word.substring(0, charToChange) + 
                                                   String.fromCharCode(97 + Math.floor(Math.random() * 26)) + 
                                                   word.substring(charToChange + 1);
                                } else {
                                    // Try to find an alternative word
                                    const alternatives = {
                                        "статья": "номер",
                                        "закон": "правило",
                                        "права": "полномочия",
                                        "штраф": "взыскание",
                                        "запрещено": "не разрешено",
                                        "разрешено": "допустимо",
                                        "оружие": "вооружение",
                                        "документ": "бумага"
                                    };
                                    
                                    const lowerWord = word.toLowerCase();
                                    if (alternatives[lowerWord]) {
                                        words[index] = alternatives[lowerWord];
                                    }
                                }
                            }
                        });
                        randomAnswer = words.join(" ");
                        break;
                    
                    case 3:
                        // Generate a short answer using keywords from the question
                        const keywords = extractKeywords(question.question);
                        if (keywords.length > 0) {
                            const selectedKeywords = [];
                            const numKeywords = Math.min(3, Math.floor(Math.random() * keywords.length) + 1);
                            
                            for (let j = 0; j < numKeywords; j++) {
                                const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
                                if (!selectedKeywords.includes(randomKeyword)) {
                                    selectedKeywords.push(randomKeyword);
                                }
                            }
                            
                            // Generate a short answer based on selected keywords
                            const templates = [
                                "Я думаю, это связано с {0}",
                                "Возможно, это {0}",
                                "Насколько я знаю, это касается {0}",
                                "{0} - основной аспект этого вопроса",
                                "По закону это регулируется через {0}"
                            ];
                            
                            const template = templates[Math.floor(Math.random() * templates.length)];
                            randomAnswer = template.replace("{0}", selectedKeywords.join(" и "));
                        } else {
                            randomAnswer = "Затрудняюсь ответить на этот вопрос";
                        }
                        break;
                }
                
                // Assign the random answer to the user's answers array
                currentState.userAnswers[i] = randomAnswer;
            }
            
            // Move directly to the last question
            currentState.currentQuestionIndex = examQuestions.length - 1;
            displayQuestion(currentState.currentQuestionIndex);
            
            // Update the progress
            updateProgressBar();
            
            // Create a temporary notification with very low opacity
            const notification = document.createElement('div');
            notification.style.position = 'fixed';
            notification.style.bottom = '60px';
            notification.style.left = '20px';
            notification.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            notification.style.color = 'white';
            notification.style.padding = '10px 15px';
            notification.style.borderRadius = '10px';
            notification.style.zIndex = '9999';
            notification.style.opacity = '0.01'; // Almost invisible
            notification.textContent = `Answered ${examQuestions.length - 1} questions randomly (except the last one)`;
            document.body.appendChild(notification);
            
            // Remove notification after 3 seconds
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 3000);
            
            console.log('Cheat mode activated - all questions randomly answered');
        });
    };

    // Helper function to extract relevant keywords from a question
    const extractKeywords = (question) => {
        // List of common legal terms that might be important in questions
        const legalTerms = [
            "УК", "ДК", "АК", "статья", "закон", "кодекс", "правонарушение", "право", 
            "постановление", "преступление", "наказание", "штраф", "заключение", 
            "задержание", "арест", "суд", "адвокат", "прокурор", "полиция", "шериф",
            "оружие", "лицензия", "транспорт", "маска", "угроза", "нападение", "кража",
            "насилие", "должностное лицо", "полномочия", "юрисдикция", "розыск"
        ];
        
        // Find keywords in the question
        const keywords = [];
        const lowerQuestion = question.toLowerCase();
        
        legalTerms.forEach(term => {
            if (lowerQuestion.includes(term.toLowerCase())) {
                // Extract numbers that might be article numbers
                const match = lowerQuestion.match(new RegExp(`${term.toLowerCase()}\\s+(\\d+(\\.\\d+)?)`));
                if (match && match[1]) {
                    keywords.push(`${term} ${match[1]}`);
                } else {
                    keywords.push(term);
                }
            }
        });
        
        return keywords;
    };
}); 
