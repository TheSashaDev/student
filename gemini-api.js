// Gemini API integration
class GeminiAPI {
    constructor() {
        // This would be your actual API key in production
        this.apiKey = 'AIzaSyAqGSx6teDEN2AW-y6fzt2tevfJdHs4WGU';
        this.apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent'; // Using 1.5-flash as it's generally more stable
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
                return this.generateDefaultComparison(safeCopy.questions);
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
                return this.generateDefaultComparison(safeCopy.questions);
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
                
                // In case of failure, return default comparisons
                return this.generateDefaultComparison(safeCopy.questions);
            }
        } catch (error) {
            console.error('Answer analysis error:', error);
            return this.generateDefaultComparison(safeCopy.questions);
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
            
             // In case of failure, return default comparisons for each question
            return questions.map((question, index) => ({
                questionNumber: index + 1,
                question: question.question.substring(0, 100) + "...",
                userAnswer: question.userAnswer || "Не ответил",
                correctAnswer: question.correctAnswer,
                comparison: "Не правильно",
                reasonExplanation: "Ошибка при анализе ответа ИИ.",
                similarityScore: 0,
                isCorrect: false
            }));
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
                    if (isNaN(score)) score = 0; // Default if parsing fails
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
            
             // If we couldn't parse all questions, mark those as incorrect by inserting a value
             while(comparisons.length < questions.length){
                 const i = comparisons.length;
                  comparisons.push({
                     questionNumber: i+1,
                     question: questions[i].question.substring(0, 100) + "...",
                     userAnswer: questions[i].userAnswer || "Не ответил",
                     correctAnswer: questions[i].correctAnswer,
                     comparison: "Не правильно",
                     reasonExplanation: "Ошибка при анализе ответа ИИ.",
                     similarityScore: 0,
                     isCorrect: false
                 });
             }
             
             // Sort by question number so results are in order
             comparisons.sort((a,b) => a.questionNumber - b.questionNumber);
            
            return comparisons;
        } catch (error) {
            console.error('Response parsing error:', error);
            
             return questions.map((question, index) => ({
                questionNumber: index + 1,
                question: question.question.substring(0, 100) + "...",
                userAnswer: question.userAnswer || "Не ответил",
                correctAnswer: question.correctAnswer,
                comparison: "Не правильно",
                reasonExplanation: "Ошибка при анализе ответа ИИ.",
                similarityScore: 0,
                isCorrect: false
            }));
        }
    }
     /**
      * Generate default comparison for error cases
      * @param {Array} questions - The questions
      * @param {number} correct - Correct answers count
      * @param {number} total - Total questions count
      * @returns {Object} - Default comparison
      */
     generateDefaultComparison(questions) {
        const zeroScore = (i) => ({
            questionNumber: i + 1,
            question: questions[i].question.substring(0, 100) + "...",
            userAnswer: questions[i].userAnswer || "Не ответил",
            correctAnswer: questions[i].correctAnswer,
            comparison: "Не правильно",
            reasonExplanation: "Ошибка при анализе ответа ИИ. Рекомендуется проверить ответ вручную.",
            similarityScore: 0,
            isCorrect: false
        });
        
         const comparisons = questions.map((q, i) => zeroScore(i));
        
         return {
             comparisons: comparisons,
             adjustedScore: {
                 correct: 0, // since all are incorrect
                 total: questions.length,
                 percentage: 0,
                 isPassing: false
             },
             timestamp: new Date().toISOString()
         };
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
}

// Create a global instance
window.geminiAPI = new GeminiAPI();