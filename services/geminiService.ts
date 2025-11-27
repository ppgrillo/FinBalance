import { GoogleGenAI, Type, FunctionDeclaration, Tool } from "@google/genai";
import { Expense, CategoryType } from "../types";
import { dbService } from "./dbService";

// ------------------------------------------------------------------
// CONFIGURACIÓN DE GEMINI AI
// La API Key se obtiene de process.env.API_KEY
// ------------------------------------------------------------------

// ------------------------------------------------------------------

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ VITE_GEMINI_API_KEY is missing! The AI features will not work.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Definition of the tool available to Gemini
const queryExpensesTool: FunctionDeclaration = {
  name: "query_expenses",
  description: "Consulta la base de datos de gastos del usuario filtrando por fecha y categoría. Úsalo para responder preguntas sobre historial, comparaciones anuales o mensuales, y totales.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      startDate: {
        type: Type.STRING,
        description: "Fecha de inicio en formato ISO (YYYY-MM-DD). Si el usuario pide un año entero (ej. 2023), usa '2023-01-01'.",
      },
      endDate: {
        type: Type.STRING,
        description: "Fecha de fin en formato ISO (YYYY-MM-DD). Si el usuario pide un año entero (ej. 2023), usa '2023-12-31'.",
      },
      category: {
        type: Type.STRING,
        description: "Filtro opcional de categoría (ej. 'Comida', 'Transporte').",
      }
    },
    required: ["startDate", "endDate"],
  },
};

const tool: Tool = {
  functionDeclarations: [queryExpensesTool],
};

export const geminiService = {
  /**
   * Chat with the Financial Advisor using Function Calling AND History Context
   */
  chat: async (history: { role: 'user' | 'model'; text: string }[]): Promise<string> => {
    try {
      if (!ai) {
        return "⚠️ Error de configuración: Falta la API Key de Gemini. Por favor configúrala en el archivo .env o en Netlify.";
      }
      const model = "gemini-2.5-flash";
      const systemInstruction = `
        Eres 'FinBot', el experto asesor financiero de la app FinBalance.
        
        TU OBJETIVO:
        Responder preguntas sobre las finanzas del usuario con precisión exacta usando la herramienta 'query_expenses'.
        
        MEMORIA Y CONTEXTO:
        - Tienes acceso al historial de la conversación. 
        - Si el usuario pregunta "¿Y en comida?" o "Dame el detalle", USA EL CONTEXTO anterior para deducir las fechas (startDate, endDate) que se estaban discutiendo.
        - No preguntes fechas de nuevo si ya se mencionaron o están implícitas en el turno anterior.
        
        CÓMO USAR LA HERRAMIENTA:
        - Llama a 'query_expenses' para obtener datos reales.
        - Puedes llamar a la herramienta múltiples veces si es necesario.
        - Para preguntas como "¿En qué gasté en Enero pasado?", calcula las fechas correctas (ej. 2024-01-01 a 2024-01-31).
        
        REGLAS DE RESPUESTA:
        - Una vez recibas los datos (JSON), procésalos mentalmente.
        - Suma totales, agrupa por categorías si te lo piden.
        - Usa TABLAS MARKDOWN para presentar listas de gastos.
        - Si la herramienta devuelve una lista vacía, dilo claramente.
        
        Fecha actual: ${new Date().toISOString().split('T')[0]}
      `;

      // Map application history to Gemini Content format
      const contents = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      // 1. Initial Call to Model with History
      const response = await ai.models.generateContent({
        model,
        contents: contents,
        config: {
          systemInstruction,
          tools: [tool],
        }
      });

      // 2. Check for Function Calls
      const functionCalls = response.functionCalls;

      if (functionCalls && functionCalls.length > 0) {
        // The model wants to query the DB
        const functionResponses = await Promise.all(
          functionCalls.map(async (call) => {
            if (call.name === "query_expenses") {
              const args = call.args as any;
              console.log("🤖 AI requesting DB query:", args);

              // Execute DB Query
              const data = await dbService.executeAIQuery({
                startDate: args.startDate,
                endDate: args.endDate,
                category: args.category
              });

              // Return result to AI
              return {
                id: call.id,
                name: call.name,
                response: { result: data } // Pass structured JSON
              };
            }
            return { id: call.id, name: call.name, response: { error: "Unknown tool" } };
          })
        );

        // 3. Send Tool Outputs back to Model to get Final Text
        // CRITICAL: We must pass the Full History + The Function Call Request + The Function Response
        const finalResponse = await ai.models.generateContent({
          model,
          contents: [
            ...contents, // Full history
            { role: "model", parts: response.candidates?.[0]?.content?.parts || [] }, // The tool call request
            { role: "user", parts: functionResponses.map(fr => ({ functionResponse: fr })) } // The data
          ],
          config: { systemInstruction }
        });

        return finalResponse.text || "No pude procesar los datos.";
      }

      // If no function call, just return text
      return response.text || "No pude generar una respuesta.";

    } catch (error) {
      console.error("Gemini Chat Error:", error);
      return "Lo siento, hubo un error conectando con mi cerebro financiero o la base de datos.";
    }
  },

  /**
   * Generate a detailed savings plan for a goal WITH structured monthly calculation
   */
  createSavingsPlan: async (goalName: string, amount: number, deadline: string, contextData: string): Promise<{ planText: string, monthlyContribution: number }> => {
    try {
      if (!ai) {
        throw new Error("Gemini API Key missing");
      }
      const model = "gemini-2.5-flash";
      const prompt = `
        El usuario quiere lograr la meta: "${goalName}" con un costo de $${amount} para la fecha ${deadline}.
        Contexto financiero actual (Cuentas y Saldos): ${contextData}.
        
        ⚠️ INSTRUCCIÓN CRÍTICA SOBRE TARJETAS DE CRÉDITO:
        - Si una cuenta tiene type: 'Credit', su 'balance' representa DEUDA (Dinero que el usuario DEBE al banco).
        - NO sumes el saldo de las tarjetas de crédito a los ahorros disponibles.
        - Al calcular la liquidez, RESTA la deuda de tarjetas de crédito de los activos (Débito/Efectivo).
        
        Fecha actual: ${new Date().toISOString()}.
        
        1. Calcula matemáticamente la aportación mensual necesaria desde HOY hasta la fecha límite.
        2. Genera un plan breve de 3 pasos.
           - Paso 1: Analiza la situación real.
           - Paso 2: Menciona la aportación mensual calculada.
           - Paso 3: Da un consejo práctico específico.
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              planText: { type: Type.STRING, description: "Markdown text with the 3 step plan" },
              monthlyContribution: { type: Type.NUMBER, description: "The calculated monthly savings amount required" }
            },
            required: ["planText", "monthlyContribution"]
          }
        }
      });

      if (!response.text) {
        throw new Error("No response text from Gemini");
      }
      const result = JSON.parse(response.text);
      return result;
    } catch (error) {
      console.error("Gemini Plan Error:", error);
      const today = new Date();
      const end = new Date(deadline);
      const diffTime = Math.abs(end.getTime() - today.getTime());
      const months = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
      const calc = months > 0 ? Math.ceil(amount / months) : amount;

      return {
        planText: "No se pudo generar el plan con IA. Se ha calculado un ahorro mensual estimado.",
        monthlyContribution: calc
      };
    }
  },

  /**
   * Analyze text or image to extract expense details
   */
  analyzeExpense: async (text?: string, imageBase64?: string, availableCategories?: string[], availableIncomeCategories?: string[], availableAccounts?: string[]): Promise<{
    amount?: number;
    category?: string;
    description?: string;
    type?: 'expense' | 'income' | 'transfer';
    destinationAccount?: string;
  }> => {
    try {
      if (!ai) throw new Error("AI not initialized");

      const model = "gemini-2.5-flash";

      const prompt = `
        Analiza el siguiente texto o imagen de una transacción financiera.
        
        Tus objetivos:
        1. Extraer el monto (número).
        2. Identificar si es Gasto (expense), Ingreso (income) o Transferencia (transfer).
           - Palabras clave Ingreso: "gané", "recibí", "depósito", "nómina", "venta", "cobré".
           - Palabras clave Gasto: "pagué", "compré", "gasté", "salida".
        3. Categorizar la transacción:
           - Si es Gasto, usa estas categorías: ${availableCategories?.join(', ') || 'Comida, Transporte, Vivienda, Otros'}.
           - Si es Ingreso, usa estas categorías: ${availableIncomeCategories?.join(', ') || 'Salario, Negocio, Regalo, Venta, Inversión, Otros'}.
           - Si no encaja, sugiere una nueva corta.
        4. Generar una descripción corta y clara.
        5. Identificar la CUENTA DE DESTINO (para ingresos) o FUENTE (para gastos) si se menciona.
           - Cuentas disponibles: ${availableAccounts?.join(', ') || 'Ninguna específica'}.
           - Ejemplo: "Depósito a BBVA" -> destinationAccount: "BBVA".
        
        Responde SOLO un JSON válido con este formato:
        {
          "amount": number,
          "category": "string",
          "description": "string",
          "type": "expense" | "income" | "transfer",
          "destinationAccount": "string (nombre de la cuenta detectada o null)"
        }

        Texto: "${text || ''}"
      `;

      const parts: any[] = [];

      if (imageBase64) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: imageBase64
          }
        });
      }

      parts.push({ text: prompt });

      const result = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }]
      });

      const textResponse = result.text;

      // Clean JSON
      const jsonString = textResponse ? textResponse.replace(/```json/g, '').replace(/```/g, '').trim() : "{}";
      const data = JSON.parse(jsonString);

      return {
        amount: data.amount,
        category: data.category,
        description: data.description,
        type: data.type,
        destinationAccount: data.destinationAccount
      };

    } catch (e) {
      console.error("Error analyzing expense:", e);
      return {};
    }
  }
};