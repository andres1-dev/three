// Subidor de datos a Supabase

const Uploader = {
  /**
   * Sube registros consolidados a Supabase
   */
  async upload(records) {
    console.log(`📤 Subiendo ${records.length} registros a Supabase...`);
    
    try {
      const response = await fetch(`${SiesaConfig.FUNCTIONS_URL}/upload-siesa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ records })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        
        try {
          const error = JSON.parse(errorText);
          errorMessage = error.error || `HTTP ${response.status}`;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log('✅ Subida completada:', result);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error subiendo a Supabase:', error);
      throw error;
    }
  }
};
