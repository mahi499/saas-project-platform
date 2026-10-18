**# Multi-Tenant SaaS Project Management Platform**



**A full-stack project management platform that enables multiple workspaces to manage projects, tasks, and team members in one application.**



**The platform is built with React on the frontend and Django REST Framework on the backend, with workspace-based access control and tenant isolation.**



**## Features**



**- User registration and authentication**

**- Workspace creation and management**

**- Multiple workspaces per application**

**- Workspace membership management**

**- Role-based access control**

**- Project creation and management**

**- Task creation and management**

**- Kanban board with drag-and-drop task updates**

**- Workspace member role management**

**- Tenant isolation to separate workspace data**

**- REST API built with Django REST Framework**

**- Automated backend tests**



**## Technology Stack**



**### Frontend**

**- React**

**- JavaScript**

**- Vite**

**- CSS**



**### Backend**

**- Python**

**- Django**

**- Django REST Framework**

**- django-cors-headers**



**### Database**

**- SQLite for local development**



**### Development Tools**

**- Git**

**- GitHub**

**- npm**



**## Architecture**



**The application follows a full-stack architecture:**



**1. \*\*Frontend:\*\* React provides the user interface.**

**2. \*\*Backend:\*\* Django processes requests and enforces permissions.**

**3. \*\*REST API:\*\* Django REST Framework connects the frontend and backend.**

**4. \*\*Database:\*\* SQLite stores application data during local development.**

**5. \*\*Tenant isolation:\*\* Workspace-based access controls help prevent users from accessing data belonging to other workspaces.**



**## Project Structure**



**```text**

**saas-project-platform/**

**├── backend/**

**│   ├── api/**

**│   │   ├── migrations/**

**│   │   ├── models.py**

**│   │   ├── serializers.py**

**│   │   ├── tests.py**

**│   │   ├── urls.py**

**│   │   └── views.py**

**│   ├── config/**

**│   │   ├── settings.py**

**│   │   └── urls.py**

**│   └── manage.py**

**├── frontend/**

**│   ├── public/**

**│   ├── src/**

**│   │   ├── App.jsx**

**│   │   ├── App.css**

**│   │   ├── index.css**

**│   │   └── main.jsx**

**│   ├── package.json**

**│   └── vite.config.js**

**├── .gitignore**

**└── README.md**

**Prerequisites**



**Install the following software before running the application:**



**Python 3.12**

**Node.js and npm**

**Git**

**Getting Started**

**1. Clone the Repository**

**git clone https://github.com/mahi499/saas-project-platform.git**

**cd saas-project-platform**

**2. Set Up the Backend**



**Open a terminal in the project directory.**



**Navigate to the backend:**



**cd backend**



**Create a Python virtual environment:**



**python -m venv .venv**



**Activate the environment in Windows PowerShell:**



**.\\.venv\\Scripts\\Activate.ps1**



**Install the backend dependencies:**



**pip install django djangorestframework django-cors-headers**



**Apply database migrations:**



**python manage.py migrate**



**Start the Django development server:**



**python manage.py runserver**



**The backend development server should be available at:**



**http://127.0.0.1:8000/**



**3. Set Up the Frontend**



**Open a second terminal.**



**Navigate to the frontend directory:**



**cd C:\\Users\\veere\\saas-project-platform\\frontend**



**Install the frontend dependencies:**



**npm install**



**Start the Vite development server:**



**npm run dev**



**Open the local URL printed in the terminal. It is commonly:**



**http://localhost:5173/**



**Keep both development servers running while using the application.**



**Running Backend Tests**



**Open a terminal and navigate to the backend directory:**



**cd C:\\Users\\veere\\saas-project-platform\\backend**



**Run the Django tests:**



**python manage.py test api**



**The test suite includes tests for tenant isolation and application behavior.**



**Security Considerations**

**Do not commit production secret keys, passwords, or API credentials.**

**Keep local environment variables and secrets out of version control.**

**Use DEBUG = False in production.**

**Configure ALLOWED\_HOSTS appropriately before deployment.**

**Use production-ready database and server settings when deploying the application.**

**Review authentication, authorization, and tenant isolation before exposing the application publicly.**

**Future Improvements**



**Potential future enhancements include:**



**GitHub Actions for continuous integration**

**Docker-based development and deployment**

**Production deployment**

**Additional automated tests**

**Further SaaS features based on project requirements**

**Author**



**GitHub: mahi499**



**License**



**No license has been added to this repository yet.**





**---**



**## After saving the file, push it to GitHub**



**Open PowerShell in your project directory:**



**```powershell**

**cd C:\\Users\\veere\\saas-project-platform**

