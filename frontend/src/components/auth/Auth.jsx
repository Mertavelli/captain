

import { useState } from 'react';
import Login from './Login';
import Signup from './Signup';

const Auth = () => {
    const [activeTab, setActiveTab] = useState('login');

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] px-4">
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-lg p-6">
                {/* Tabs */}
                <div className="flex mb-6 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                    <button
                        onClick={() => setActiveTab('login')}
                        className={`w-1/2 py-2 text-sm font-medium transition-colors cursor-pointer ${activeTab === 'login'
                            ? 'bg-white text-black shadow-inner'
                            : 'text-gray-500 hover:bg-gray-200'
                            }`}
                    >
                        Login
                    </button>
                    <button
                        onClick={() => setActiveTab('signup')}
                        className={`w-1/2 py-2 text-sm font-medium transition-colors cursor-pointer ${activeTab === 'signup'
                            ? 'bg-white text-black shadow-inner'
                            : 'text-gray-500 hover:bg-gray-200'
                            }`}
                    >
                        Signup
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-4">
                    {activeTab === 'login' ? <Login /> : <Signup />}
                </div>
            </div>
        </div>
    );
};

export default Auth;
