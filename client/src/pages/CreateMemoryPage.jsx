import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiImage, FiSend, FiX, FiPlus } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const CreateMemoryPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [step, setStep] = useState(0); // 0: Select File, 1: Write Content
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    const newUrls = [...imageUrls];

    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 5MB`);
          continue;
        }

        const formData = new FormData();
        formData.append('avatar', file);

        const res = await api.post('/upload/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        newUrls.push(res.data.url);
      }
      setImageUrls(newUrls);
      setStep(1);
    } catch (err) {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    const updated = imageUrls.filter((_, i) => i !== index);
    setImageUrls(updated);
    if (updated.length === 0 && !content) setStep(0);
  };

  const handlePost = async () => {
    if (!content.trim() && imageUrls.length === 0) return toast.error('Write something or add a photo!');
    
    setLoading(true);
    try {
      await api.post('/memories', { content, imageUrls });
      toast.success('Memory posted to your vibes!');
      navigate('/memories');
    } catch (err) {
      toast.error('Failed to post memory');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg">
       {/* Header */}
       <header className="flex items-center justify-between px-4 py-6 bg-transparent border-b border-white/5">
        <button 
          onClick={() => navigate(-1)} 
          className="w-10 h-10 flex items-center justify-center text-white bg-surfaceAlt/80 rounded-full hover:bg-white/10 transition-colors active:scale-95"
        >
          <FiChevronLeft className="text-2xl" />
        </button>
        <h1 className="text-lg font-bold text-white tracking-tight">Create Memory</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto p-6 flex flex-col">
        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div 
              key="step0"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex-1 flex flex-col items-center justify-center space-y-10"
            >
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Choose a Vibe</h2>
                <p className="text-white/30 text-sm font-medium">Select photos for your memory or post a text vibe.</p>
              </div>

              <div className="w-full max-w-xs space-y-4">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  multiple 
                  onChange={handleFileChange} 
                />
                
                <button 
                  onClick={() => fileInputRef.current.click()}
                  disabled={uploading}
                  className="w-full py-8 bg-white text-black rounded-[32px] font-black flex flex-col items-center gap-3 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 shadow-2xl shadow-white/5"
                >
                  {uploading ? (
                     <div className="w-8 h-8 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center">
                        <FiImage className="text-2xl" />
                      </div>
                      <span className="tracking-widest text-xs">SELECT FROM GALLERY</span>
                    </>
                  )}
                </button>

                <button 
                  onClick={() => setStep(1)}
                  className="w-full py-5 bg-surfaceAlt/30 text-white/40 border border-white/5 rounded-3xl font-black hover:bg-white/5 transition-all uppercase tracking-widest text-[10px]"
                >
                  Continue with text only
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 flex flex-col space-y-6"
            >
               {imageUrls.length > 0 && (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {imageUrls.map((url, i) => (
                      <div key={i} className="relative flex-shrink-0 w-48 aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-xl group">
                         <img src={url} alt="" className="w-full h-full object-cover" />
                         <button 
                          onClick={() => removeImage(i)}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-red-500 transition-colors"
                         >
                           <FiX size={14} />
                         </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      className="flex-shrink-0 w-24 aspect-video rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center text-white/20 hover:text-primary hover:border-primary/50 transition-all"
                    >
                      <FiPlus size={24} />
                    </button>
                  </div>
               )}

               <div className="flex-1 min-h-[200px]">
                  <textarea 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write..."
                    autoFocus
                    className="w-full h-full bg-transparent text-2xl font-medium text-white placeholder:text-white/10 resize-none focus:outline-none py-4 leading-relaxed"
                  />
               </div>

               <div className="pb-8">
                 <button 
                  onClick={handlePost}
                  disabled={loading || (!content.trim() && imageUrls.length === 0)}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none uppercase tracking-widest text-sm"
                 >
                   {loading ? (
                     <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                   ) : (
                     <>
                       <FiSend className="text-xl" />
                       POST MEMORY
                     </>
                   )}
                 </button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default CreateMemoryPage;
