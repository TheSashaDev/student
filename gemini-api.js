// Gemini API integration
class GeminiAPI {
    constructor() {
        // This would be your actual API key in production
        this.apiKey = 'AIzaSyAqGSx6teDEN2AW-y6fzt2tevfJdHs4WGU';
        this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
        this.requestsCount = 0; // Track number of API requests
        this.maxRequests = 6; // Maximum number of API requests allowed (increased to 6)
        this.failedBatches = []; // Track batches that failed and need retry
    }

    /**
     * Compare user answers with correct answers using AI-based analysis
     * @param {Object} data - The exam data with questions and answers
     * @returns {Promise<Object>} - The comparison results
     */
    async analyzeAnswers(data) {
        try {
            // Make a defensive copy of the data
            const safeCopy = JSON.parse(JSON.stringify(data || {}));
            
            // Validate input data
            if (!safeCopy) {
                console.error('No exam data provided');
                return this.generateDefaultComparison([], 0, 0);
            }
            
            // Set defaults for missing values
            safeCopy.student = safeCopy.student || { name: 'Unknown Student', id: 'Unknown' };
            safeCopy.questions = safeCopy.questions || [];
            safeCopy.correctCount = safeCopy.correctCount || 0;
            safeCopy.totalQuestions = safeCopy.totalQuestions || (safeCopy.questions ? safeCopy.questions.length : 0);
            safeCopy.percentage = safeCopy.percentage || 0;
            
            // Check if we've reached the maximum allowed requests
            if (this.requestsCount >= this.maxRequests) {
                console.warn(`Reached maximum API requests limit (${this.maxRequests})`);
                // Return fallback evaluations for all questions
                return this.generateFallbackComparisons(safeCopy.questions);
            }
            
            // Check if this is a retry batch from a previous failure
            let isRetry = false;
            if (this.failedBatches.length > 0 && this.failedBatches.some(batch => this.isSameBatch(batch, safeCopy.questions))) {
                isRetry = true;
                console.log('Processing retry batch for failed questions');
            }
            
            // Increment request counter
            this.requestsCount++;
            console.log(`API request ${this.requestsCount} of ${this.maxRequests}${isRetry ? ' (retry)' : ''}`);
            
            // Process multiple questions in a single API call when possible
            try {
                const comparisons = await this.processBatchQuestions(safeCopy.questions);
                
                // If successful, remove this batch from failed batches if it was a retry
                if (isRetry) {
                    this.failedBatches = this.failedBatches.filter(batch => 
                        !this.isSameBatch(batch, safeCopy.questions));
                }
                
                // Calculate score based on evaluations
                const correctAnswers = comparisons.filter(item => item.isCorrect).length;
                const percentageScore = Math.round((correctAnswers / safeCopy.questions.length) * 100);
                
                return {
                    comparisons: comparisons,
                    adjustedScore: {
                        correct: correctAnswers,
                        total: safeCopy.questions.length,
                        percentage: percentageScore,
                        isPassing: percentageScore >= 70
                    },
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                console.error('Batch processing error:', error);
                
                // Add this batch to failed batches for potential retry if not already there
                if (!isRetry) {
                    this.failedBatches.push(safeCopy.questions);
                }
                
                // Use fallback comparisons
                return this.generateFallbackComparisons(safeCopy.questions);
            }
        } catch (error) {
            console.error('Answer analysis error:', error);
            return this.generateDefaultComparison([], 0, 0);
        }
    }
    
    /**
     * Check if two batches contain the same questions
     * @param {Array} batch1 - First batch of questions
     * @param {Array} batch2 - Second batch of questions
     * @returns {boolean} - True if the batches contain the same questions
     */
    isSameBatch(batch1, batch2) {
        if (batch1.length !== batch2.length) return false;
        
        // Compare questions by their text content
        for (let i = 0; i < batch1.length; i++) {
            const q1 = batch1[i].question;
            const found = batch2.some(q => q.question === q1);
            if (!found) return false;
        }
        
        return true;
    }
    
    /**
     * Process a batch of questions in a single API call when possible
     * @param {Array} questions - Array of question objects
     * @returns {Promise<Array>} - Array of comparison results
     */
    async processBatchQuestions(questions) {
        try {
            // Create a single prompt for all questions in the batch
            const batchPrompt = this.formatBatchPrompt(questions);
            
            // Call the Gemini API once for all questions in the batch
            const response = await this.callGeminiAPI(batchPrompt);
            
            if (!response) {
                throw new Error("Empty API response");
            }
            
            // Process the response to extract evaluation for each question
            return this.parseBatchResponse(response, questions);
        } catch (error) {
            console.error('Batch processing error:', error);
            
            // Fall back to individual processing with fallback evaluations
            return questions.map((question, index) => {
                // Get fallback evaluation for this question
                const fallbackEval = this.fallbackEvaluateAnswer(
                    question.userAnswer || "Не ответил",
                    question.correctAnswer,
                    question.question
                );
                
                return {
                    questionNumber: index + 1,
                    question: question.question.substring(0, 100) + "...",
                    userAnswer: question.userAnswer || "Не ответил",
                    correctAnswer: question.correctAnswer,
                    comparison: fallbackEval.category,
                    reasonExplanation: fallbackEval.reason,
                    similarityScore: fallbackEval.score,
                    isCorrect: fallbackEval.category === "Правильно"
                };
            });
        }
    }
    
    /**
     * Format a batch prompt for multiple questions
     * @param {Array} questions - Array of question objects
     * @returns {string} - Formatted batch prompt
     */
    formatBatchPrompt(questions) {
        // Create a prompt that includes multiple questions for evaluation
        let prompt = `
        Оцени ответы студента на ${questions.length} вопросов экзамена. Будь максимально лояльным.
        
        Я предоставлю несколько вопросов с правильными ответами и ответами студента. 
        Для каждого вопроса нужно определить:
        1. Категорию оценки: Правильно, Частично правильно, или Не правильно
        2. Краткое объяснение (1-2 предложения)
        3. Числовую оценку от 0 до 100
        
        Будь очень терпимым к ответам студентов. Ответ считается правильным, если:
        - Он содержит ключевые термины или понятия из правильного ответа
        - Он передает основную суть правильного ответа, даже если формулировка отличается
        - Ответ только указывает на номер статьи или закона, если это был вопрос о конкретной статье
        - Ответ краткий, но по существу
        
        Для каждого вопроса используй следующий формат:
        
        ВОПРОС {номер}: {текст вопроса}
        КАТЕГОРИЯ: [Правильно | Частично правильно | Не правильно]
        ОБЪЯСНЕНИЕ: [краткое объяснение]
        ОЦЕНКА: [число от 0 до 100]
        
        Вот вопросы и ответы:
        `;
        
        // Add each question and answer pair to the prompt
        questions.forEach((q, index) => {
            const userAnswer = q.userAnswer || "Не ответил";
            prompt += `
            
            ВОПРОС ${index + 1}: ${q.question}
            Правильный ответ: ${q.correctAnswer}
            Ответ студента: ${userAnswer}
            `;
        });
        
        return prompt;
    }
    
    /**
     * Parse the batch response from the Gemini API
     * @param {string} response - The API response
     * @param {Array} questions - Original questions array
     * @returns {Array} - Array of parsed evaluations
     */
    parseBatchResponse(response, questions) {
        try {
            const comparisons = [];
            const lines = response.split('\n');
            let currentQuestion = null;
            let category = null;
            let explanation = null;
            let score = null;
            
            // Process each line of the response
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Look for question markers
                const questionMatch = line.match(/ВОПРОС\s+(\d+):/i);
                if (questionMatch) {
                    // If we have a complete previous question, add it to comparisons
                    if (currentQuestion !== null && category && explanation && score !== null) {
                        const questionIndex = currentQuestion - 1;
                        if (questionIndex >= 0 && questionIndex < questions.length) {
                            const q = questions[questionIndex];
                            comparisons.push({
                                questionNumber: currentQuestion,
                                question: q.question.substring(0, 100) + "...",
                                userAnswer: q.userAnswer || "Не ответил",
                                correctAnswer: q.correctAnswer,
                                comparison: category,
                                reasonExplanation: explanation,
                                similarityScore: score,
                                isCorrect: category === "Правильно"
                            });
                        }
                    }
                    
                    // Start new question
                    currentQuestion = parseInt(questionMatch[1], 10);
                    category = null;
                    explanation = null;
                    score = null;
                    continue;
                }
                
                // Look for category, explanation, score
                if (line.startsWith("КАТЕГОРИЯ:")) {
                    category = line.substring("КАТЕГОРИЯ:".length).trim();
                    // Apply lenient category normalization
                    if (category.toLowerCase().includes("правильно") && 
                        !category.toLowerCase().includes("не правильно") && 
                        !category.toLowerCase().includes("частично")) {
                        category = "Правильно";
                    } else if (category.toLowerCase().includes("частично")) {
                        category = "Частично правильно";
                    } else if (category.toLowerCase().includes("не правильно") || 
                              category.toLowerCase().includes("неправильно")) {
                        category = "Не правильно";
                    }
                } else if (line.startsWith("ОБЪЯСНЕНИЕ:")) {
                    explanation = line.substring("ОБЪЯСНЕНИЕ:".length).trim();
                } else if (line.startsWith("ОЦЕНКА:")) {
                    const scoreText = line.substring("ОЦЕНКА:".length).trim();
                    score = parseInt(scoreText, 10);
                    if (isNaN(score)) score = 50; // Default if parsing fails
                }
            }
            
            // Add the last question if complete
            if (currentQuestion !== null && category && explanation && score !== null) {
                const questionIndex = currentQuestion - 1;
                if (questionIndex >= 0 && questionIndex < questions.length) {
                    const q = questions[questionIndex];
                    comparisons.push({
                        questionNumber: currentQuestion,
                        question: q.question.substring(0, 100) + "...",
                        userAnswer: q.userAnswer || "Не ответил",
                        correctAnswer: q.correctAnswer,
                        comparison: category,
                        reasonExplanation: explanation,
                        similarityScore: score,
                        isCorrect: category === "Правильно"
                    });
                }
            }
            
            // If we couldn't parse all questions, fill in the missing ones with fallback evaluations
            if (comparisons.length < questions.length) {
                // Find which questions are missing
                const foundQuestionNumbers = comparisons.map(c => c.questionNumber);
                
                for (let i = 0; i < questions.length; i++) {
                    const questionNumber = i + 1;
                    if (!foundQuestionNumbers.includes(questionNumber)) {
                        const q = questions[i];
                        const fallbackEval = this.fallbackEvaluateAnswer(
                            q.userAnswer || "Не ответил",
                            q.correctAnswer,
                            q.question
                        );
                        
                        comparisons.push({
                            questionNumber: questionNumber,
                            question: q.question.substring(0, 100) + "...",
                            userAnswer: q.userAnswer || "Не ответил",
                            correctAnswer: q.correctAnswer,
                            comparison: fallbackEval.category,
                            reasonExplanation: fallbackEval.reason,
                            similarityScore: fallbackEval.score,
                            isCorrect: fallbackEval.category === "Правильно"
                        });
                    }
                }
            }
            
            // Sort by question number
            comparisons.sort((a, b) => a.questionNumber - b.questionNumber);
            
            return comparisons;
        } catch (error) {
            console.error('Batch response parsing error:', error);
            
            // Fallback to individual evaluations
            return questions.map((q, index) => {
                const fallbackEval = this.fallbackEvaluateAnswer(
                    q.userAnswer || "Не ответил",
                    q.correctAnswer,
                    q.question
                );
                
                return {
                    questionNumber: index + 1,
                    question: q.question.substring(0, 100) + "...",
                    userAnswer: q.userAnswer || "Не ответил",
                    correctAnswer: q.correctAnswer,
                    comparison: fallbackEval.category,
                    reasonExplanation: fallbackEval.reason,
                    similarityScore: fallbackEval.score,
                    isCorrect: fallbackEval.category === "Правильно"
                };
            });
        }
    }
    
    /**
     * Generate fallback comparisons for a set of questions
     * @param {Array} questions - Array of question objects
     * @returns {Object} - Comparison results with fallback evaluations
     */
    generateFallbackComparisons(questions) {
        const comparisons = questions.map((question, index) => {
            const userAnswer = question.userAnswer || "Не ответил";
            const fallbackEval = this.fallbackEvaluateAnswer(
                userAnswer,
                question.correctAnswer,
                question.question
            );
            
            return {
                questionNumber: index + 1,
                question: question.question.substring(0, 100) + "...",
                userAnswer: userAnswer,
                correctAnswer: question.correctAnswer,
                comparison: fallbackEval.category,
                reasonExplanation: fallbackEval.reason,
                similarityScore: fallbackEval.score,
                isCorrect: fallbackEval.category === "Правильно"
            };
        });
        
        const correctAnswers = comparisons.filter(item => item.isCorrect).length;
        const percentageScore = Math.round((correctAnswers / questions.length) * 100);
        
        return {
            comparisons: comparisons,
            adjustedScore: {
                correct: correctAnswers,
                total: questions.length,
                percentage: percentageScore,
                isPassing: percentageScore >= 70
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Call the Gemini API to evaluate an answer
     * @param {string} userAnswer - The user's answer
     * @param {string} correctAnswer - The correct answer
     * @param {string} question - The question text
     * @returns {Promise<Object>} - Evaluation result with category, reason and score
     */
    async getGeminiEvaluation(userAnswer, correctAnswer, question) {
        try {
            // Clean up answers for processing
            const cleanUserAnswer = userAnswer.trim();
            const cleanCorrectAnswer = correctAnswer.trim();
            
            // Check for empty answer
            if (!cleanUserAnswer) {
                return {
                    category: "Не правильно",
                    reason: "Ответ отсутствует",
                    score: 0
                };
            }
            
            // Format the prompt for the model
            const prompt = this.formatPrompt(question, cleanUserAnswer, cleanCorrectAnswer);
            
            // Call the Gemini API
            const response = await this.callGeminiAPI(prompt);
            
            if (!response) {
                throw new Error("Empty API response");
            }
            
            // Parse the response
            return this.parseGeminiResponse(response, cleanUserAnswer, cleanCorrectAnswer, question);
        } catch (error) {
            console.error('Gemini API error:', error);
            // Return fallback evaluation if API call fails
            return this.fallbackEvaluateAnswer(userAnswer, correctAnswer, question);
        }
    }
    
    /**
     * Format prompt for the Gemini model
     * @param {string} question - The question
     * @param {string} userAnswer - The user's answer
     * @param {string} correctAnswer - The correct answer
     * @returns {string} - Formatted prompt
     */
    formatPrompt(question, userAnswer, correctAnswer) {
        return `
        Оцени ответ студента на вопрос по экзамену. Будь максимально лояльным.
        
        Вопрос: ${question}
        
        Правильный ответ: ${correctAnswer}
        
        Ответ студента: ${userAnswer}
        
        Твоя задача:
        1. Определить, является ли ответ студента правильным, частично правильным или неправильным.
        2. Дать краткое объяснение (максимум 1-2 предложения).
        3. Оценить ответ по шкале от 0 до 100.
        
        Будь очень терпимым к ответам студентов. Ответ считается правильным, если:
        - Он содержит ключевые термины или понятия из правильного ответа
        - Он передает основную суть правильного ответа, даже если формулировка отличается
        - Ответ только указывает на номер статьи или закона, если это был вопрос о конкретной статье
        - Ответ краткий, но по существу
        
        Не занижай оценки за краткость, форматирование или незначительные ошибки. Оценивай суть ответа.
        
        Формат ответа:
        Категория: [Правильно | Частично правильно | Не правильно]
        Объяснение: [краткое объяснение]
        Оценка: [число от 0 до 100]
        `;
    }
    
    /**
     * Call the Gemini API
     * @param {string} prompt - The prompt for the model
     * @returns {Promise<string>} - The API response
     */
    async callGeminiAPI(prompt) {
        try {
            const url = `${this.apiEndpoint}?key=${this.apiKey}`;
            
            const requestBody = {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    topP: 0.95,
                    topK: 50,
                    maxOutputTokens: 500
                }
            };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error("Invalid API response format");
            }
            
            // Extract the text from the response
            const textPart = data.candidates[0].content.parts.find(part => part.text);
            
            if (!textPart) {
                throw new Error("No text in API response");
            }
            
            return textPart.text;
        } catch (error) {
            console.error('API call error:', error);
            return null;
        }
    }
    
    /**
     * Parse the response from the Gemini API
     * @param {string} response - The API response
     * @param {string} userAnswer - The user's answer
     * @param {string} correctAnswer - The correct answer
     * @param {string} question - The question text
     * @returns {Object} - Parsed evaluation
     */
    parseGeminiResponse(response, userAnswer, correctAnswer, question) {
        try {
            // Try to extract evaluation from structured format
            const categoryMatch = response.match(/Категория:\s*(Правильно|Частично правильно|Не правильно)/i);
            const explanationMatch = response.match(/Объяснение:\s*(.+?)(?:\n|$)/is);
            const scoreMatch = response.match(/Оценка:\s*(\d+)/i);
            
            if (categoryMatch && explanationMatch && scoreMatch) {
                const category = categoryMatch[1].trim();
                const reason = explanationMatch[1].trim();
                const score = parseInt(scoreMatch[1], 10);
                
                // Apply some leniency by increasing scores for edge cases
                let adjustedScore = Math.min(100, Math.max(0, score));
                if (score >= 45 && score < 50) adjustedScore = 50; // Push borderline cases up
                
                return {
                    category: this.adjustCategoryBasedOnAdditionalRules(category, userAnswer, correctAnswer, question, adjustedScore),
                    reason,
                    score: adjustedScore
                };
            }
            
            // If structured format fails, try to intelligently parse the response
            let category = "Частично правильно"; // Default
            let reason = response.slice(0, 100); // Use first part of response as reason
            let score = 50; // Default score
            
            if (response.toLowerCase().includes("правильно") && 
                !response.toLowerCase().includes("неправильно") &&
                !response.toLowerCase().includes("не правильно")) {
                category = "Правильно";
                score = 85;
            } else if (response.toLowerCase().includes("неправильно") ||
                      response.toLowerCase().includes("не правильно") ||
                      response.toLowerCase().includes("неверно")) {
                category = "Не правильно";
                score = 25; // Slightly higher default for incorrect answers
            }
            
            // Try to extract a score if mentioned
            const anyScoreMatch = response.match(/(\d{1,3})(?:\s*\/\s*100|\s*%|баллов|балла|балл)/i);
            if (anyScoreMatch) {
                score = parseInt(anyScoreMatch[1], 10);
            }
            
            // Based on sentiment, adjust scores
            if (response.toLowerCase().includes("отлично") || 
                response.toLowerCase().includes("полностью верно")) {
                score = Math.max(score, 95);
            } else if (response.toLowerCase().includes("почти") || 
                      response.toLowerCase().includes("близко")) {
                score = Math.max(score, 75);
            }
            
            const finalCategory = this.adjustCategoryBasedOnAdditionalRules(category, userAnswer, correctAnswer, question, score);
            return {
                category: finalCategory,
                reason: reason.length > 100 ? reason.substring(0, 97) + '...' : reason,
                score: Math.min(100, Math.max(0, score))
            };
        } catch (error) {
            console.error('Response parsing error:', error);
            
            // Provide a generous fallback based on answer length and content similarity
            if (userAnswer) {
                // Check for law articles
                if (this.containsLawReference(userAnswer, correctAnswer, question)) {
                    return {
                        category: "Правильно",
                        reason: "В ответе указаны правильные статьи/номера законов",
                        score: 90
                    };
                }
                
                // Give benefit of doubt for longer answers
                if (userAnswer.length > 30) {
                    return {
                        category: "Частично правильно",
                        reason: "Ответ содержит существенную информацию",
                        score: 70
                    };
                } else if (userAnswer.length > 0) {
                    return {
                        category: "Частично правильно",
                        reason: "Ответ предоставлен",
                        score: 55
                    };
                }
            }
            
            return {
                category: "Не правильно",
                reason: "Ответ отсутствует или слишком короткий",
                score: 0
            };
        }
    }
    
    /**
     * Adjust category based on additional rules for more leniency
     * @param {string} category - Initial category
     * @param {string} userAnswer - User's answer
     * @param {string} correctAnswer - Correct answer
     * @param {string} question - Question text
     * @param {number} score - Current score
     * @returns {string} - Adjusted category
     */
    adjustCategoryBasedOnAdditionalRules(category, userAnswer, correctAnswer, question, score) {
        // Law article specific rule
        if (this.containsLawReference(userAnswer, correctAnswer, question)) {
            return "Правильно";
        }
        
        // Adjust based on score thresholds
        if (score >= 50 && category === "Не правильно") {
            return "Частично правильно";
        }
        
        if (score >= 75 && category === "Частично правильно") {
            return "Правильно";
        }
        
        // Key terms matching rule
        if (category !== "Правильно" && this.containsKeyTerms(userAnswer, correctAnswer)) {
            return score >= 50 ? "Правильно" : "Частично правильно";
        }
        
        return category;
    }
    
    /**
     * Check if userAnswer contains key terms from correctAnswer
     * @param {string} userAnswer - User's answer
     * @param {string} correctAnswer - Correct answer
     * @returns {boolean} - True if key terms are found
     */
    containsKeyTerms(userAnswer, correctAnswer) {
        const userLower = userAnswer.toLowerCase();
        const correctLower = correctAnswer.toLowerCase();
        
        // Extract important words (longer than 4 chars) from correct answer
        const keyTerms = correctLower.split(/\s+/)
            .filter(word => word.length > 4)
            .map(word => word.replace(/[.,;:()]/g, ''));
        
        // Check if at least 30% of key terms are in user answer
        const foundTermsCount = keyTerms.filter(term => userLower.includes(term)).length;
        return keyTerms.length > 0 && (foundTermsCount / keyTerms.length) >= 0.3;
    }
    
    /**
     * Check if answer contains law article references
     * @param {string} userAnswer - User's answer
     * @param {string} correctAnswer - Correct answer
     * @param {string} question - Question text
     * @returns {boolean} - True if valid law reference is found
     */
    containsLawReference(userAnswer, correctAnswer, question) {
        const isLawQuestion = question.toLowerCase().includes("статья") || 
                             question.toLowerCase().includes("ук") || 
                             question.toLowerCase().includes("кодекс") ||
                             question.toLowerCase().includes("закон");
                             
        if (!isLawQuestion) return false;
        
        // Pattern for law articles with numbers
        const userLower = userAnswer.toLowerCase();
        const correctLower = correctAnswer.toLowerCase();
        
        // Check if both contain article numbers
        const userNumbers = userLower.match(/\d+\.?\d*/g) || [];
        const correctNumbers = correctLower.match(/\d+\.?\d*/g) || [];
        
        if (userNumbers.length === 0) return false;
        
        // Check if any number from user answer appears in correct answer
        return userNumbers.some(num => correctLower.includes(num)) ||
               // Or if article abbreviations match with numbers
               (userLower.includes("ук") && correctLower.includes("ук")) ||
               (userLower.includes("ак") && correctLower.includes("ак")) ||
               (userLower.includes("гк") && correctLower.includes("гк"));
    }
    
    /**
     * Fallback evaluation method if API call fails
     * @param {string} userAnswer - The user's answer
     * @param {string} correctAnswer - The correct answer
     * @param {string} question - The question
     * @returns {Object} - Basic evaluation
     */
    fallbackEvaluateAnswer(userAnswer, correctAnswer, question) {
        // Clean up answers for basic processing
        const cleanUserAnswer = userAnswer.toLowerCase().trim();
        const cleanCorrectAnswer = correctAnswer.toLowerCase().trim();
        
        if (!cleanUserAnswer) {
            return {
                category: "Не правильно",
                reason: this.generateAIExplanation("empty", question, "", correctAnswer),
                score: 0
            };
        }
        
        // Check for law article reference first
        if (this.containsLawReference(cleanUserAnswer, cleanCorrectAnswer, question)) {
            return {
                category: "Правильно",
                reason: this.generateAIExplanation("article_reference", question, userAnswer, correctAnswer),
                score: 90
            };
        }
        
        // Calculate simple text similarity
        const similarity = this.calculateSimilarity(cleanUserAnswer, cleanCorrectAnswer);
        
        // Check for number match in answers related to law articles
        const isArticleQuestion = question.toLowerCase().includes("статья") || 
                                 question.toLowerCase().includes("ук") || 
                                 question.toLowerCase().includes("ак") || 
                                 question.toLowerCase().includes("кодекс");
                                 
        const hasArticleNumbers = /\d+\.\d+|\d+\s*(ук|ак|гк|дк|)/i.test(cleanUserAnswer);
        
        if (isArticleQuestion && hasArticleNumbers && 
            this.containsAnyNumber(cleanUserAnswer, cleanCorrectAnswer)) {
            return {
                category: "Правильно",
                reason: this.generateAIExplanation("article_numbers", question, userAnswer, correctAnswer),
                score: 90
            };
        }
        
        // More lenient categorization based on text similarity
        if (similarity > 0.5) {  // Lowered from 0.7
            return {
                category: "Правильно",
                reason: this.generateAIExplanation("high_similarity", question, userAnswer, correctAnswer, similarity),
                score: 85 + Math.floor(similarity * 15)
            };
        } else if (similarity > 0.3) {  // Lowered from 0.4
            return {
                category: "Частично правильно",
                reason: this.generateAIExplanation("medium_similarity", question, userAnswer, correctAnswer, similarity),
                score: 60 + Math.floor(similarity * 30)  // Higher base score
            };
        } else if (cleanUserAnswer.length > 10) {
            // Give benefit of doubt for answers with some content
            return {
                category: "Частично правильно",
                reason: this.generateAIExplanation("attempt_made", question, userAnswer, correctAnswer),
                score: 50
            };
        } else {
            return {
                category: "Не правильно",
                reason: this.generateAIExplanation("low_similarity", question, userAnswer, correctAnswer, similarity),
                score: 20 + Math.floor(similarity * 60)  // Higher base score
            };
        }
    }
    
    /**
     * Generate an AI-like explanation for fallback evaluations
     * @param {string} type - Type of explanation to generate
     * @param {string} question - The question
     * @param {string} userAnswer - The user's answer
     * @param {string} correctAnswer - The correct answer
     * @param {number} similarity - Optional similarity score
     * @returns {string} - AI-like explanation
     */
    generateAIExplanation(type, question, userAnswer, correctAnswer, similarity = 0) {
        // Extract key terms from the correct answer
        const extractKeyTerms = (text) => {
            if (!text) return [];
            const words = text.toLowerCase().split(/\s+/);
            return words.filter(word => 
                word.length > 4 && 
                !['этот', 'того', 'быть', 'весь', 'один', 'такой', 'свой', 'наш', 'ваш'].includes(word)
            );
        };
        
        const keyTerms = extractKeyTerms(correctAnswer);
        const userKeyTerms = extractKeyTerms(userAnswer);
        
        // Find matching terms
        const matchingTerms = keyTerms.filter(term => 
            userKeyTerms.some(userTerm => userTerm.includes(term) || term.includes(userTerm))
        );
        
        // Check for law-specific content
        const hasLawContent = question.toLowerCase().match(/(ук|гк|дк|ак|статья|кодекс|закон)/g);
        const articleMatch = correctAnswer.match(/статья\s+(\d+(\.\d+)?)/i) || 
                             correctAnswer.match(/(\d+(\.\d+)?)\s*(ук|гк|дк|ак)/i);
        
        const explanations = {
            // No answer provided
            empty: [
                "Ответ отсутствует, поэтому невозможно оценить понимание материала студентом.",
                "Студент не предоставил ответа на данный вопрос.",
                "К сожалению, ответ не был дан, что не позволяет произвести оценку."
            ],
            
            // Correct article reference
            article_reference: [
                `Ответ студента верно указывает на ${hasLawContent ? "правовые нормы" : "ключевые аспекты"}, упомянутые в эталонном ответе.`,
                `Студент правильно идентифицировал ${articleMatch ? `статью ${articleMatch[1]}` : "соответствующие нормативные положения"}.`,
                `В ответе корректно отражены законодательные нормы, относящиеся к вопросу.`
            ],
            
            // Correct article numbers
            article_numbers: [
                `Ответ содержит правильные номера статей, что является ключевым в данном вопросе.`,
                `Студент верно указал числовые идентификаторы правовых норм, что считается правильным ответом.`,
                `Числовые обозначения статей в ответе соответствуют правильному ответу.`
            ],
            
            // High similarity
            high_similarity: [
                `Ответ студента демонстрирует глубокое понимание вопроса и содержит ${matchingTerms.length} ключевых элементов правильного ответа.`,
                `Формулировка может отличаться от эталонной, но суть ответа полностью соответствует правильному.`,
                `Ответ содержит все необходимые элементы и корректно раскрывает тему вопроса.`
            ],
            
            // Medium similarity
            medium_similarity: [
                `Ответ частично правильный, содержит некоторые верные элементы, но не является полным.`,
                `Студент продемонстрировал понимание темы, но ответ не включает все ключевые аспекты.`,
                `В ответе присутствуют правильные моменты, но он требует дополнения.`
            ],
            
            // Low similarity but attempt made
            attempt_made: [
                `Ответ имеет некоторое отношение к вопросу, но не содержит достаточно конкретики.`,
                `Видно, что студент имеет некоторое представление о теме, но ответ нуждается в значительном уточнении.`,
                `Ответ слишком общий, но демонстрирует попытку рассуждения на данную тему.`
            ],
            
            // Low similarity
            low_similarity: [
                `Ответ существенно отличается от правильного и не содержит ключевых элементов.`,
                `В ответе отсутствуют важные аспекты, необходимые для правильного решения вопроса.`,
                `Ответ не отражает понимания основных принципов, изложенных в правильном ответе.`
            ]
        };
        
        // Get random explanation from the appropriate category
        const explanationArray = explanations[type] || explanations.low_similarity;
        const randomIndex = Math.floor(Math.random() * explanationArray.length);
        
        // Add personalization based on the specific question content
        let personalization = "";
        if (hasLawContent && type !== "empty") {
            personalization = ` ${articleMatch ? 
                `Особенно важно было упомянуть статью ${articleMatch[1]}.` : 
                "В юридических вопросах точность формулировок имеет решающее значение."}`;
        }
        
        return explanationArray[randomIndex] + personalization;
    }
    
    /**
     * Calculate simple similarity between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} - Similarity score between 0-1
     */
    calculateSimilarity(str1, str2) {
        // Simple word overlap calculation with more leniency
        const words1 = str1.split(/\s+/).filter(word => word.length > 2);
        const words2 = str2.split(/\s+/).filter(word => word.length > 2);
        
        if (words1.length === 0 || words2.length === 0) {
            return 0;
        }
        
        // Check for partial word matches as well
        let matchCount = 0;
        for (const word1 of words1) {
            // Full word match
            if (words2.includes(word1)) {
                matchCount += 1;
                continue;
            }
            
            // Partial word match (word is contained within another word)
            if (word1.length > 4) {
                if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
                    matchCount += 0.7;
                    continue;
                }
            }
        }
        
        // Calculate a more lenient similarity
        return Math.min(1, matchCount / Math.max(words1.length, words2.length) * 1.2);
    }
    
    /**
     * Check if string1 contains any number that appears in string2
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {boolean} - True if there's a common number
     */
    containsAnyNumber(str1, str2) {
        const numbers1 = str1.match(/\d+\.?\d*/g) || [];
        const numbers2 = str2.match(/\d+\.?\d*/g) || [];
        
        // More lenient matching - check if any numbers are similar
        return numbers1.some(num1 => 
            numbers2.some(num2 => 
                num1 === num2 || 
                num1.includes(num2) || 
                num2.includes(num1)
            )
        );
    }

    /**
     * Generate default comparison for error cases
     * @param {Array} questions - The questions
     * @param {number} correct - Correct answers count
     * @param {number} total - Total questions count
     * @returns {Object} - Default comparison
     */
    generateDefaultComparison(questions, correct, total) {
        return {
            comparisons: questions.map((_, index) => ({
                questionNumber: index + 1,
                question: "Вопрос недоступен",
                comparison: "Не правильно",
                reasonExplanation: this.generateAIExplanation("empty", "Вопрос недоступен", "", ""),
                similarityScore: 0,
                isCorrect: false
            })),
            adjustedScore: {
                correct: correct,
                total: total,
                percentage: total > 0 ? Math.round((correct / total) * 100) : 0,
                isPassing: total > 0 ? (correct / total) >= 0.7 : false
            },
            timestamp: new Date().toISOString()
        };
    }
}

// Create a global instance
window.geminiAPI = new GeminiAPI();