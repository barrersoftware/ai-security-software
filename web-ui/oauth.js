/**
 * OAuth Integration Module
 * Supports Google and Microsoft authentication
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const auth = require('./auth');

class OAuthManager {
    constructor() {
        this.initialized = false;
    }

    init(app) {
        if (this.initialized) return;

        // Initialize passport
        app.use(passport.initialize());
        app.use(passport.session());

        // Serialize user
        passport.serializeUser((user, done) => {
            done(null, user.id);
        });

        // Deserialize user
        passport.deserializeUser(async (id, done) => {
            try {
                const user = await auth.getUserById(id);
                done(null, user);
            } catch (error) {
                done(error, null);
            }
        });

        // Setup Google OAuth if configured
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
            this.setupGoogle();
        }

        // Setup Microsoft OAuth if configured
        if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
            this.setupMicrosoft();
        }

        this.initialized = true;
    }

    setupGoogle() {
        passport.use(new GoogleStrategy({
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback'
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user exists
                let user = await auth.getUserByEmail(profile.emails[0].value);

                if (!user) {
                    // Create new user
                    const username = profile.emails[0].value.split('@')[0];
                    const result = await auth.createUser({
                        username: username,
                        email: profile.emails[0].value,
                        name: profile.displayName,
                        oauth_provider: 'google',
                        oauth_id: profile.id,
                        role: 'viewer' // Default role for OAuth users
                    });
                    user = result.user;
                } else if (!user.oauth_provider) {
                    // Link OAuth to existing account
                    await auth.linkOAuth(user.id, 'google', profile.id);
                }

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }));
    }

    setupMicrosoft() {
        passport.use(new MicrosoftStrategy({
            clientID: process.env.MICROSOFT_CLIENT_ID,
            clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
            callbackURL: process.env.MICROSOFT_CALLBACK_URL || '/api/auth/microsoft/callback',
            scope: ['user.read']
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                // Check if user exists
                let user = await auth.getUserByEmail(profile.emails[0].value);

                if (!user) {
                    // Create new user
                    const username = profile.emails[0].value.split('@')[0];
                    const result = await auth.createUser({
                        username: username,
                        email: profile.emails[0].value,
                        name: profile.displayName,
                        oauth_provider: 'microsoft',
                        oauth_id: profile.id,
                        role: 'viewer' // Default role for OAuth users
                    });
                    user = result.user;
                } else if (!user.oauth_provider) {
                    // Link OAuth to existing account
                    await auth.linkOAuth(user.id, 'microsoft', profile.id);
                }

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }));
    }

    /**
     * Get OAuth configuration status
     */
    getOAuthStatus() {
        return {
            google: {
                enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
                configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL)
            },
            microsoft: {
                enabled: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
                configured: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_CALLBACK_URL)
            }
        };
    }

    /**
     * Setup OAuth routes
     */
    setupRoutes(app) {
        // Google OAuth routes
        app.get('/api/auth/google',
            passport.authenticate('google', { scope: ['profile', 'email'] })
        );

        app.get('/api/auth/google/callback',
            passport.authenticate('google', { failureRedirect: '/login.html?error=oauth_failed' }),
            async (req, res) => {
                // Generate token for the user
                const token = await auth.generateToken(req.user.id);
                
                // Redirect to dashboard with token
                res.redirect(`/index.html?token=${token}`);
            }
        );

        // Microsoft OAuth routes
        app.get('/api/auth/microsoft',
            passport.authenticate('microsoft', { scope: ['user.read'] })
        );

        app.get('/api/auth/microsoft/callback',
            passport.authenticate('microsoft', { failureRedirect: '/login.html?error=oauth_failed' }),
            async (req, res) => {
                // Generate token for the user
                const token = await auth.generateToken(req.user.id);
                
                // Redirect to dashboard with token
                res.redirect(`/index.html?token=${token}`);
            }
        );

        // OAuth status endpoint
        app.get('/api/auth/oauth/status', (req, res) => {
            res.json(this.getOAuthStatus());
        });
    }
}

module.exports = new OAuthManager();
