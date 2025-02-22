from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from models.document import DocumentCreate, Document, DocumentUpdate
from utils.auth import get_current_user
from config.database import documents_collection, projects_collection
from bson import ObjectId
from datetime import datetime
from typing import List, Dict, Any
import json


router = APIRouter()

@router.post("/", response_model=Document)
async def create_document(document: DocumentCreate, current_user = Depends(get_current_user)):
    print(f"Creating document for project {document.project_id}")
    try:
        # Verify project exists and belongs to user
        project = projects_collection.find_one({
            "_id": ObjectId(document.project_id),
            "user_id": str(current_user["_id"])
        })
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Convert annotations to dictionaries
        annotations_dicts = [annotation.dict() for annotation in document.annotations] if document.annotations else []
        print(f"Annotations dicts: {annotations_dicts}")
        # Create document dictionary
        doc_dict = {
            "text": document.text,
            "project_id": str(document.project_id),
            "filename": document.filename or "untitled.txt",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "annotations": annotations_dicts,
            "status": document.status
        }
        
        print(f"Inserting document: {doc_dict}")
        result = documents_collection.insert_one(doc_dict)
        doc_dict["id"] = str(result.inserted_id)
        
        print(f"Successfully created document with ID: {doc_dict['id']}")
        return Document(**doc_dict)
        
    except Exception as e:
        print(f"Error creating document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating document: {str(e)}")

@router.post("/upload")
async def upload_document(
    project_id: str = Form(...),
    files: List[UploadFile] = File(...),
    current_user = Depends(get_current_user)
):
    print(f"Uploading {len(files)} documents for project {project_id}")
    
    try:
        # Verify project exists and belongs to user
        project = projects_collection.find_one({
            "_id": ObjectId(project_id),
            "user_id": str(current_user["_id"])
        })
        if not project:
            print(f"Project not found. Project ID: {project_id}, User ID: {current_user['_id']}")
            raise HTTPException(status_code=404, detail="Project not found")
        
        uploaded_documents = []
        failed_documents = []
        
        for file in files:
            print(f"Processing file: {file.filename}, Content-Type: {file.content_type}")
            try:
                content = await file.read()
                # Try to decode with UTF-8 first
                try:
                    text = content.decode('utf-8')
                except UnicodeDecodeError:
                    # If UTF-8 fails, try with latin-1 as a fallback
                    text = content.decode('latin-1')
                    
                print(f"Successfully decoded file content. Content length: {len(text)}")
                
                doc_dict = {
                    "text": text,
                    "project_id": str(project_id),
                    "filename": file.filename,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "annotations": [],
                    "entities": [],
                    "status": "pending"
                }
                
                print(f"Inserting document with filename: {file.filename}")
                result = documents_collection.insert_one(doc_dict)
                doc_dict["id"] = str(result.inserted_id)
                
                uploaded_documents.append(Document(**doc_dict))
                print(f"Successfully uploaded document: {file.filename}")
                
            except UnicodeDecodeError as e:
                print(f"Error decoding file {file.filename}: {str(e)}")
                failed_documents.append({
                    "filename": file.filename,
                    "error": "Unable to decode file content. Please ensure the file is a valid text file."
                })
            except Exception as e:
                print(f"Error processing file {file.filename}: {str(e)}")
                failed_documents.append({
                    "filename": file.filename,
                    "error": str(e)
                })
            
        response = {
            "success": True,
            "uploaded_count": len(uploaded_documents),
            "uploaded_documents": uploaded_documents,
            "failed_count": len(failed_documents),
            "failed_documents": failed_documents
        }
        
        if len(failed_documents) > 0 and len(uploaded_documents) == 0:
            # If all files failed, return a 400 status
            raise HTTPException(status_code=400, detail=response)
            
        return response
            
    except Exception as e:
        print(f"Error in upload process: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail=f"Error uploading documents: {str(e)}"
        )

@router.get("/project/{project_id}", response_model=Dict[str, Any])
async def get_project_documents(
    project_id: str,
    current_user = Depends(get_current_user),
    page: int = 1,
    docsPerPage: int = 100,  # Default limit of 100, but can be overridden
):
    skip = (page - 1) * docsPerPage
    print(f"Fetching documents for project {project_id} with skip={skip}, docsPerPage={docsPerPage}")
    
    try:
        # Verify project exists and belongs to user
        project = projects_collection.find_one({
            "_id": ObjectId(project_id),
            "user_id": str(current_user["_id"])
        })
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Convert project_id to string for comparison
        project_id_str = str(project_id)
        print(f"Looking for documents with project_id: {project_id_str}")
        
        # First get total count
        total_count = documents_collection.count_documents({"project_id": project_id_str})
        print(f"Total documents in project: {total_count}")
        
        # Get all documents for this project
        cursor = documents_collection.find({"project_id": project_id_str}).sort("created_at", -1).skip(skip).limit(docsPerPage)
        
        # Convert documents to list and process them
        documents = []
        for doc in cursor:
            try:
                # Convert _id to string id
                doc["id"] = str(doc.pop("_id"))
                
                # Ensure all required fields exist with defaults
                doc.setdefault("text", "")
                doc.setdefault("filename", f"document_{doc['id']}.txt")
                doc.setdefault("project_id", project_id_str)
                doc.setdefault("status", "pending")
                doc.setdefault("annotations", [])
                
                # Convert datetime objects to strings
                if isinstance(doc.get("created_at"), datetime):
                    doc["created_at"] = doc["created_at"].isoformat()
                if isinstance(doc.get("updated_at"), datetime):
                    doc["updated_at"] = doc["updated_at"].isoformat()
                
                # Create Document object
                document = Document(**doc)
                documents.append(document)
                print(f"Processed document {doc['id']}")
            except Exception as e:
                print(f"Error processing document: {str(e)}")
                print(f"Document data: {doc}")
                continue
        
        # Sort documents by created_at in descending order
        # documents.sort(key=lambda x: x.created_at, reverse=True)
        
        # Apply pagination if needed
        # if limit > 0:
        #     start = skip
        #     end = skip + limit
        #     documents = documents[start:end]
        
        print(f"Returning {len(documents)} documents")
        return {"total_count": total_count, "documents": documents}
        
    except Exception as e:
        print(f"Error in get_project_documents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching documents: {str(e)}")

@router.get("/{document_id}", response_model=Document)
async def get_document(document_id: str, current_user = Depends(get_current_user)):
    try:
        doc = documents_collection.find_one({"_id": ObjectId(document_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Verify project belongs to user
        project = projects_collection.find_one({
            "_id": ObjectId(doc["project_id"]),
            "user_id": str(current_user["_id"])
        })
        if not project:
            raise HTTPException(status_code=403, detail="Not authorized to access this document")
        
        # Ensure all required fields exist with defaults
        doc["id"] = str(doc.pop("_id"))
        doc.setdefault("text", "")
        doc.setdefault("filename", f"document_{doc['id']}.txt")
        doc.setdefault("project_id", str(doc["project_id"]))
        doc.setdefault("status", "pending")
        doc.setdefault("annotations", [])
        
        # Convert datetime objects to strings
        if isinstance(doc.get("created_at"), datetime):
            doc["created_at"] = doc["created_at"].isoformat()
        if isinstance(doc.get("updated_at"), datetime):
            doc["updated_at"] = doc["updated_at"].isoformat()
        
        # Print debug info
        print("Document data:", doc)
        
        return Document(**doc)
    except Exception as e:
        print(f"Error in get_document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching document: {str(e)}")

@router.put("/{document_id}", response_model=Document)
async def update_document(
    document_id: str,
    document_update: DocumentUpdate,
    current_user = Depends(get_current_user)
):
    try:
        # Verify document exists
        doc = documents_collection.find_one({"_id": ObjectId(document_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Verify project belongs to user
        project = projects_collection.find_one({
            "_id": ObjectId(doc["project_id"]),
            "user_id": str(current_user["_id"])
        })
        if not project:
            raise HTTPException(status_code=403, detail="Not authorized to update this document")
        
        # Create update dictionary with only provided fields
        update_dict = {}
        if document_update.text is not None:
            update_dict["text"] = document_update.text
        if document_update.filename is not None:
            update_dict["filename"] = document_update.filename
        if document_update.status is not None:
            update_dict["status"] = document_update.status
        if document_update.annotations is not None:
            update_dict["annotations"] = [annotation.dict() for annotation in document_update.annotations]
        
        update_dict["updated_at"] = datetime.utcnow()
        
        # Update document
        result = documents_collection.update_one(
            {"_id": ObjectId(document_id)},
            {"$set": update_dict}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Document not found or no changes made")
        
        # Get updated document
        updated_doc = documents_collection.find_one({"_id": ObjectId(document_id)})
        updated_doc["id"] = str(updated_doc.pop("_id"))
        
        return Document(**updated_doc)
        
    except Exception as e:
        print(f"Error updating document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating document: {str(e)}")

@router.delete("/bulk-delete")
async def bulk_delete_documents(request: Request):
    try:
        data = await request.json()
        document_ids = data.get('document_ids', [])
        if not document_ids:
            raise HTTPException(status_code=400, detail="No document IDs provided")

        # Convert string IDs to ObjectId
        object_ids = [ObjectId(doc_id) for doc_id in document_ids]
        
        # Delete documents
        result = documents_collection.delete_many({"_id": {"$in": object_ids}})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="No documents found to delete")
            
        return {"message": f"Successfully deleted {result.deleted_count} documents"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/project/{project_id}/export")
async def export_project_data(project_id: str, current_user = Depends(get_current_user)):
    # Verify project exists and belongs to user
    project = projects_collection.find_one({
        "_id": ObjectId(project_id),
        "user_id": str(current_user["_id"])
    })
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all documents for the project
    documents = []
    cursor = documents_collection.find({"project_id": project_id})
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        documents.append(doc)
    
    export_data = {
        "project": {
            "id": str(project["_id"]),
            "name": project["name"],
            "entity_classes": project["entity_classes"]
        },
        "documents": documents
    }
    
    return export_data
