# Skybox Generator

Skybox Generator is a React-based web application that allows users to create dynamic 3D skybox environments based on user prompts and selected styles. The application integrates with a backend API for generating skyboxes and provides a user-friendly interface to explore, preview, and set skybox backgrounds dynamically.

## Features

- **Prompt-based Skybox Generation**: Generate 3D skybox environments by entering prompts and selecting styles.
- **Dynamic Background Updates**: Preview and set generated skyboxes as the application background.
- **Style Selection**: Choose from a variety of skybox styles fetched dynamically from the backend.
- **Negative Prompting**: Optionally add negative prompts to refine the generated skyboxes.
- **Real-time Generation Status**: Track the progress of skybox generation through a polling mechanism.
- **Responsive Design**: Optimized for various screen sizes with a clean and modern UI.

## Technologies Used

### Frontend

- **React**: Core framework for building the user interface.
- **React Router**: For managing application routes.
- **Axios**: For handling API requests.
- **TailwindCSS**: For responsive and modern styling.

### Backend

- The backend API is expected to be running locally on `${apiUrl}`. It includes endpoints for fetching skybox styles, generating skyboxes, and checking generation status.


## Folder Structure

```plaintext
src/
├── Components/
│   ├── Header.js        # Application header
│   ├── MainSection.js   # Main content area with prompt input and skybox generation
│   ├── Footer.js        # Footer component
├── screens/
│   ├── Explore.js       # Explore skybox styles
│   ├── History.js       # History of generated skyboxes
│   ├── SkyboxFullScreen.js # Full-screen skybox viewer
├── App.js               # Main application component
├── index.js             # Entry point of the application
├── styles/              # TailwindCSS configuration
```

## API Endpoints

### 1. Fetch Skybox Styles

**GET** `/api/skybox/getSkyboxStyles`

- Response: Array of available skybox styles.

### 2. Generate Skybox

**POST** `/api/imagine/generateImagine`

- Body: `{ prompt, skybox_style_id, negative_text (optional) }`
- Response: `{ id: <generated_image_id> }`

### 3. Get Skybox Generation Status

**GET** `/api/imagine/getImagineById`

- Query Parameters: `id=<generated_image_id>`
- Response: `{ status: 'complete' | 'failed', file_url, title, prompt }`

## Customization

- Modify **TailwindCSS** configurations in `tailwind.config.js` to update styles.
- Update API endpoints in `MainSection.js` or relevant components if backend URLs change.


## Acknowledgements

- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Axios](https://axios-http.com/)
- Special thanks to the backend team for providing the API integration

---


