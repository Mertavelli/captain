

import { login } from "./actions"

const Login = () => {

    return (
        <form className="space-y-4">
            <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                    E-Mail
                </label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition"
                    placeholder="you@example.com"
                />
            </div>

            <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                    Passwort
                </label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition"
                    placeholder="••••••••"
                />
            </div>

            <button
                type="submit"
                formAction={login}
                className="w-full bg-accent hover:bg-accent/90 cursor-pointer text-white py-2 rounded-md transition font-medium"
            >
                Login
            </button>
        </form>
    )
}

export default Login
