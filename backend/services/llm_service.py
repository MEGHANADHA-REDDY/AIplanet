import os
from typing import List, Dict, Any
from openai import OpenAI
import google.generativeai as genai

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.getenv('OPENAI_API_KEY', ''))

# Initialize Gemini
genai.configure(api_key=os.getenv('GOOGLE_API_KEY', ''))

class LLMService:
    def __init__(self):
        self.openai_available = bool(os.getenv('OPENAI_API_KEY'))
        self.gemini_available = bool(os.getenv('GOOGLE_API_KEY'))
    
    def generate_response_openai(self, query: str, context: str = "", model: str = "gpt-4o-mini", temperature: float = 0.7) -> str:
        """
        Generate response using OpenAI GPT models.
        
        Args:
            query (str): User query
            context (str): Context from knowledge base
            model (str): OpenAI model to use
            temperature (float): Temperature for response generation (0.0 to 1.0)
            
        Returns:
            str: Generated response
        """
        try:
            # Build the prompt
            if context:
                prompt = f"Context: {context}\n\nQuestion: {query}\n\nAnswer:"
            else:
                prompt = f"Question: {query}\n\nAnswer:"
            
            response = openai_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a helpful AI assistant. Answer based on the provided context when available."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=temperature
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")
    
    def generate_response_gemini(self, query: str, context: str = "", temperature: float = 0.7) -> str:
        """
        Generate response using Google Gemini Pro.
        
        Args:
            query (str): User query
            context (str): Context from knowledge base
            temperature (float): Temperature for response generation (0.0 to 1.0)
            
        Returns:
            str: Generated response
        """
        try:
            # Build the prompt
            if context:
                prompt = f"Context: {context}\n\nQuestion: {query}\n\nAnswer:"
            else:
                prompt = f"Question: {query}\n\nAnswer:"
            
            # Try different Gemini models
            gemini_models = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']
            
            for model_name in gemini_models:
                try:
                    print(f"Trying Gemini model: {model_name}")
                    model = genai.GenerativeModel(model_name)
                    # Gemini uses generation_config for temperature
                    generation_config = genai.types.GenerationConfig(
                        temperature=temperature,
                        max_output_tokens=1000
                    )
                    response = model.generate_content(prompt, generation_config=generation_config)
                    return response.text
                except Exception as e:
                    print(f"Model {model_name} failed: {str(e)}")
                    continue
            
            # If all models fail, raise an error
            raise Exception("All Gemini models are unavailable")
            
        except Exception as e:
            raise Exception(f"Gemini API error: {str(e)}")
    
    def generate_response(self, query: str, context: str = "", preferred_model: str = "auto", temperature: float = 0.7) -> Dict[str, Any]:
        """
        Generate response using the preferred model or fallback to available models.
        
        Args:
            query (str): User query
            context (str): Context from knowledge base
            preferred_model (str): Preferred model ("openai", "gemini", or "auto")
            temperature (float): Temperature for response generation (0.0 to 1.0)
            
        Returns:
            Dict: Response with text and metadata
        """
        response_data = {
            "response": "",
            "model_used": "",
            "success": False,
            "error": ""
        }
        
        try:
            if preferred_model == "openai" and self.openai_available:
                response_data["response"] = self.generate_response_openai(query, context, temperature=temperature)
                response_data["model_used"] = "openai"
                response_data["success"] = True
                
            elif preferred_model == "gemini" and self.gemini_available:
                response_data["response"] = self.generate_response_gemini(query, context, temperature=temperature)
                response_data["model_used"] = "gemini"
                response_data["success"] = True
                
            elif preferred_model == "auto":
                # Try OpenAI first, then Gemini
                if self.openai_available:
                    try:
                        response_data["response"] = self.generate_response_openai(query, context, temperature=temperature)
                        response_data["model_used"] = "openai"
                        response_data["success"] = True
                    except:
                        if self.gemini_available:
                            response_data["response"] = self.generate_response_gemini(query, context, temperature=temperature)
                            response_data["model_used"] = "gemini"
                            response_data["success"] = True
                        else:
                            raise Exception("No LLM services available")
                elif self.gemini_available:
                    response_data["response"] = self.generate_response_gemini(query, context, temperature=temperature)
                    response_data["model_used"] = "gemini"
                    response_data["success"] = True
                else:
                    raise Exception("No LLM services available")
            else:
                raise Exception(f"Preferred model '{preferred_model}' not available")
                
        except Exception as e:
            response_data["error"] = str(e)
            response_data["success"] = False
        
        return response_data
    
    def test_models(self) -> Dict[str, bool]:
        """
        Test which LLM models are available and working.
        
        Returns:
            Dict: Status of each model
        """
        results = {
            "openai": False,
            "gemini": False
        }
        
        # Test OpenAI
        if self.openai_available:
            try:
                test_response = self.generate_response_openai("Hello", model="gpt-4o-mini")
                results["openai"] = bool(test_response)
            except:
                pass
        
        # Test Gemini
        if self.gemini_available:
            try:
                test_response = self.generate_response_gemini("Hello")
                results["gemini"] = bool(test_response)
            except:
                pass
        
        return results 