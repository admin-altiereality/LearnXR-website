import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService } from '../services/subscriptionService';
import { PricingTiers } from '../Components/PricingTiers';
import { FaCheckCircle, FaRocket, FaShieldAlt, FaInfinity } from 'react-icons/fa';

const Pricing = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    const loadSubscription = async () => {
      if (user?.uid) {
        try {
          const userSubscription = await subscriptionService.getUserSubscription(user.uid);
          setSubscription(userSubscription);
        } catch (error) {
          console.error('Error loading subscription:', error);
        }
      }
    };
    
    loadSubscription();
  }, [user?.uid]);

  const features = [
    {
      icon: FaRocket,
      title: 'Lightning Fast',
      description: 'Transform ideas into immersive 3D environments in seconds, not hours'
    },
    {
      icon: FaShieldAlt,
      title: 'Enterprise Security',
      description: 'Your creative work is encrypted, private, and always under your control'
    },
    {
      icon: FaInfinity,
      title: 'Unlimited Potential',
      description: 'Scale from prototype to production with plans that grow with your vision'
    }
  ];

  return (
    <div className="min-h-screen bg-layered bg-texture relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/8 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/8 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 right-1/3 w-96 h-96 bg-amber-500/6 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }}></div>
        <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-orange-500/6 rounded-full blur-3xl animate-blob" style={{ animationDelay: '1s' }}></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(251, 146, 60, 0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(251, 146, 60, 0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      {/* Header Section */}
      <section className="relative pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 backdrop-blur-md border border-amber-500/30 shadow-lg shadow-amber-500/10 mb-6 sm:mb-8 font-mono text-xs tracking-wider"
            >
              <span className="text-amber-300 font-semibold drop-shadow-sm">PRICING</span>
            </motion.div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold mb-4 sm:mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent drop-shadow-sm">
                Simple, Transparent
              </span>
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-orange-300 to-amber-400 bg-clip-text text-transparent drop-shadow-lg">
                Pricing
              </span>
            </h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-base sm:text-lg lg:text-xl text-gray-400 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed font-body px-4"
            >
              Choose the perfect plan for your 3D creation needs. Start free, scale as you grow. No hidden fees, cancel anytime.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* Pricing Tiers Section */}
      <section className="relative py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            <PricingTiers currentSubscription={subscription} />
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-transparent"></div>
        <div className="relative max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-4 sm:mb-6">
              <span className="text-white">Built for </span>
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Creators</span>
            </h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto font-body">
              Every feature designed to amplify your creative process
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.7, 
                  delay: index * 0.15,
                  ease: [0.16, 1, 0.3, 1]
                }}
                viewport={{ once: true, margin: "-50px" }}
                className="group relative p-6 sm:p-8 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-black/50 via-black/30 to-black/20 backdrop-blur-md card-glow card-glow-hover overflow-hidden"
              >
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-500/0 via-amber-500/8 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/25 border border-amber-500/40 flex items-center justify-center mb-4 sm:mb-6 group-hover:border-amber-500/60 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-amber-500/30 transition-all duration-300">
                    <feature.icon className="text-xl sm:text-2xl text-amber-300 drop-shadow-sm" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-display font-semibold text-white mb-2 sm:mb-3 group-hover:text-amber-50 transition-colors">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-gray-300 leading-relaxed font-body group-hover:text-gray-200 transition-colors">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-12 sm:mb-16"
          >
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold mb-4 sm:mb-6">
              <span className="text-white">Questions? </span>
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">Answers.</span>
            </h2>
          </motion.div>

          <div className="space-y-3 sm:space-y-4">
            {[
              {
                question: 'Can I change my plan later?',
                answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.'
              },
              {
                question: 'What payment methods do you accept?',
                answer: 'We accept all major credit cards, debit cards, and UPI payments through our secure payment gateway.'
              },
              {
                question: 'Do you offer refunds?',
                answer: 'We offer a 30-day money-back guarantee. If you\'re not satisfied with our service, contact us for a full refund.'
              },
              {
                question: 'Are there any usage limits?',
                answer: 'Each plan has specific generation limits per month. Free plan includes 5 generations, Pro plan includes 60 generations, and Team plan includes 120 generations. Each plan also has different asset limits per generation. For custom quotas and enterprise needs, please contact our sales team. Check your plan details for more information.'
              }
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.6, 
                  delay: index * 0.1,
                  ease: [0.16, 1, 0.3, 1]
                }}
                viewport={{ once: true, margin: "-50px" }}
                className="group p-5 sm:p-6 lg:p-8 rounded-xl border border-amber-500/20 bg-gradient-to-br from-black/40 via-black/30 to-black/20 backdrop-blur-md hover:border-amber-500/40 hover:bg-gradient-to-br hover:from-black/50 hover:via-black/40 hover:to-black/30 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10"
              >
                <h3 className="text-base sm:text-lg font-display font-semibold text-white mb-2 sm:mb-3 flex items-start">
                  <span className="text-amber-400 mr-2 sm:mr-3 mt-0.5 sm:mt-1 font-mono text-xs sm:text-sm">→</span>
                  <span>{faq.question}</span>
                </h3>
                <p className="text-sm sm:text-base text-gray-400 leading-relaxed font-body pl-5 sm:pl-6">{faq.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Pricing;

